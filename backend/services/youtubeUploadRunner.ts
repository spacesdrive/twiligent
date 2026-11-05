import { fetchFileRange, fetchWholeFile } from './cloudinary/cloudinaryApi.ts';
import { GoogleApiError, querySession, sendChunk, setThumbnail, startUploadSession, videoStatus } from './youtube/googleApi.ts';
import {
    DEFAULT_UNITS_PER_DAY, MAX_UPLOAD_ATTEMPTS, UNITS, UPLOAD_LEASE_SECONDS, UPLOADS_PER_DAY,
    classifyGoogleFailure, confirmedFromRange, nextChunk, nextPacificMidnight, retryDelayMs,
} from '../lib/youtubeUpload.ts';
import { pacificDay } from '../lib/youtubeQuota.ts';
import { DatabaseError, UpstreamError, UpstreamTimeoutError } from '../lib/errors.ts';
import { errorFields } from '../lib/logger.ts';
import type { YouTubeConnectService } from './youtubeConnectService.ts';
import type { StoredYouTubeUpload, UploadProgress, YouTubeUploadRepository } from '../repositories/youtubeUploadRepository.ts';
import type { YouTubeConnectionRepository } from '../repositories/youtubeConnectionRepository.ts';
import type { QuotaBucket, YouTubeQuotaLedgerRepository } from '../repositories/youtubeQuotaLedgerRepository.ts';
import type { RequestContext } from '../types/context.ts';
import type { YouTubeUploadState } from '../../shared/types/youtubePublishing.ts';

export interface YouTubeRunnerDeps {
    uploads: YouTubeUploadRepository;
    connections: YouTubeConnectionRepository;
    connect: YouTubeConnectService;
    ledger: YouTubeQuotaLedgerRepository;
    context: RequestContext;
}

export interface YouTubeRunBudget {
    // subrequests this run may still make, after what its invocation already spent
    subrequests: number;
    timeBudgetMs: number;
}

export interface YouTubeRunOutcome {
    jobId: string | null;
    state: YouTubeUploadState | null;
    chunks: number;
    subrequests: number;
}

export interface YouTubeUploadRunner {
    run(budget: YouTubeRunBudget): Promise<YouTubeRunOutcome>;
}

// processing a video takes minutes; checking more often only spends quota
const PROCESSING_CHECK_MS = 3 * 60 * 1000;
// one chunk is a Cloudinary read, a Google write and a progress save
const SUBREQUESTS_PER_CHUNK = 3;
// a chunk is not started without this much time left, so the run never stops halfway through a write
const CHUNK_TIME_MS = 60 * 1000;
// YouTube takes custom thumbnails up to 2 MB
const THUMBNAIL_MAX_BYTES = 2 * 1024 * 1024;
const LOST_ANSWER = 'YouTube received the whole video, but its answer was lost and the upload address no longer works. Check your channel before trying again, so the video is not uploaded twice.';

// stopped the run for a reason that is not an error, with the job left as it is
class LeaseLost extends Error {}

// one job per run, moved as far as the run's subrequests and time allow; every write checks this run still holds the job
export function createYouTubeUploadRunner({ uploads, connections, connect, ledger, context }: YouTubeRunnerDeps): YouTubeUploadRunner {
    const { signal, log, requestId: owner } = context;

    return {
        async run({ subrequests, timeBudgetMs }) {
            const started = Date.now();
            let spent = 1;
            const claimed = await uploads.claim(owner, UPLOAD_LEASE_SECONDS);
            if (!claimed) return { jobId: null, state: null, chunks: 0, subrequests: spent };
            const job: StoredYouTubeUpload = claimed;

            let chunks = 0;
            let state: YouTubeUploadState = job.state;
            let session = job.sessionUri;
            let confirmed = job.bytesConfirmed;
            let videoId = job.videoId;

            const canAfford = (calls: number) => spent + calls <= subrequests - 1;
            const timeLeft = () => timeBudgetMs - (Date.now() - started);
            async function save(progress: UploadProgress): Promise<void> {
                spent++;
                if (!(await uploads.saveLeased(job.id, owner, progress))) throw new LeaseLost();
            }
            async function release(progress: UploadProgress): Promise<void> {
                spent++;
                await uploads.releaseLeased(job.id, owner, progress);
                state = progress.state ?? state;
            }
            async function reserve(bucket: QuotaBucket, units: number): Promise<boolean> {
                spent++;
                const ok = await ledger.reserve(pacificDay(), bucket, units, bucket === 'uploads' ? UPLOADS_PER_DAY : DEFAULT_UNITS_PER_DAY);
                if (!ok) await release({ state: 'waiting_quota', nextAttemptAt: nextPacificMidnight().toISOString(), lastError: 'The YouTube allowance for today is used up; the upload continues after midnight Pacific time.' });
                return ok;
            }

            try {
                spent++;
                const connection = await connections.findById(job.connectionId);
                if (!connection) {
                    await release({ state: 'failed', lastError: 'The YouTube connection for this upload was removed.' });
                    return { jobId: job.id, state, chunks, subrequests: spent };
                }
                spent += 2;
                const token = await connect.accessTokenFor(connection);
                if (!token) {
                    await release({ state: 'needs_reconnect', lastError: 'Google no longer accepts this channel\'s sign-in. Choose Verify again on the channel on the Accounts page.' });
                    return { jobId: job.id, state, chunks, subrequests: spent };
                }

                // a job that waited for the quota goes back to where it was
                if (state === 'waiting_quota') state = job.videoId ? 'processing' : session ? 'uploading' : 'queued';

                if (state === 'queued') {
                    if (!(await reserve('uploads', 1))) return { jobId: job.id, state, chunks, subrequests: spent };
                    spent++;
                    session = await startUploadSession(token, job, job.sourceBytes, job.contentType, signal);
                    // saved before any byte is sent, so a run that dies here resumes this session instead of starting a second video
                    await save({ sessionUri: session, state: 'uploading', bytesConfirmed: 0 });
                    state = 'uploading';
                    confirmed = 0;
                }

                if (state === 'uploading' && session) {
                    spent++;
                    const status = await querySession(token, session, job.sourceBytes, signal);
                    if (status.kind === 'done') {
                        videoId = status.videoId;
                        state = 'processing';
                        await save({ state, videoId, bytesConfirmed: job.sourceBytes });
                    } else {
                        confirmed = confirmedFromRange(status.range);
                    }
                    while (state === 'uploading' && canAfford(SUBREQUESTS_PER_CHUNK) && timeLeft() > CHUNK_TIME_MS) {
                        const range = nextChunk(confirmed, job.sourceBytes);
                        if (!range) break;
                        spent++;
                        const part = await fetchFileRange(job.sourceUrl, range.first, range.last, signal);
                        spent++;
                        const result = await sendChunk(token, session, part, range.first, job.sourceBytes, signal);
                        chunks++;
                        if (result.kind === 'done') {
                            videoId = result.videoId;
                            state = 'processing';
                            await save({ state, videoId, bytesConfirmed: job.sourceBytes, attempts: 0, lastError: null });
                        } else {
                            confirmed = confirmedFromRange(result.range);
                            await save({ bytesConfirmed: confirmed, attempts: 0, lastError: null });
                        }
                    }
                    if (state === 'uploading') {
                        await release({ state, nextAttemptAt: new Date().toISOString() });
                        return { jobId: job.id, state, chunks, subrequests: spent };
                    }
                    // processing has only just started; the next run checks on it
                    await release({ state: 'processing', nextAttemptAt: new Date(Date.now() + PROCESSING_CHECK_MS).toISOString() });
                    return { jobId: job.id, state, chunks, subrequests: spent };
                }

                if (state === 'processing' && videoId) {
                    if (!(await reserve('default', UNITS.videosList))) return { jobId: job.id, state, chunks, subrequests: spent };
                    spent++;
                    const status = await videoStatus(token, videoId, signal);
                    if (!status) {
                        await release({ state: 'failed', lastError: 'YouTube no longer has this video. It may have been deleted on the channel.' });
                    } else if (['failed', 'rejected', 'deleted'].includes(status.uploadStatus)) {
                        await release({ state: 'failed', lastError: `YouTube did not accept the video (${status.failureReason ?? status.uploadStatus}).` });
                    } else if (status.uploadStatus === 'processed' || status.processingStatus === 'succeeded') {
                        state = job.thumbnailUrl ? 'finalizing' : 'done';
                        if (state === 'done') await release({ state, lastError: null });
                    } else {
                        await release({ state: 'processing', nextAttemptAt: new Date(Date.now() + PROCESSING_CHECK_MS).toISOString() });
                    }
                    if (state !== 'finalizing') return { jobId: job.id, state, chunks, subrequests: spent };
                }

                if (state === 'finalizing' && videoId && job.thumbnailUrl) {
                    if (!(await reserve('default', UNITS.thumbnailSet))) return { jobId: job.id, state, chunks, subrequests: spent };
                    spent += 2;
                    try {
                        const image = await fetchWholeFile(job.thumbnailUrl, THUMBNAIL_MAX_BYTES, signal);
                        await setThumbnail(token, videoId, image, job.thumbnailUrl.endsWith('.png') ? 'image/png' : 'image/jpeg', signal);
                        await release({ state: 'done', lastError: null });
                    } catch (err) {
                        // the video is up; a thumbnail YouTube refuses (an unverified channel, say) never undoes that
                        if (err instanceof GoogleApiError && classifyGoogleFailure(err.httpStatus, err.googleReason) === 'permanent') {
                            await release({ state: 'done', lastError: `The video is published, but YouTube did not take the thumbnail: ${err.message}` });
                        } else {
                            throw err;
                        }
                    }
                    return { jobId: job.id, state, chunks, subrequests: spent };
                }

                await release({ state: 'failed', lastError: 'The upload was in a state the runner could not continue from.' });
                return { jobId: job.id, state, chunks, subrequests: spent };
            } catch (err) {
                if (err instanceof LeaseLost) {
                    log.warn('youtube upload lease lost', { jobId: job.id });
                    return { jobId: job.id, state, chunks, subrequests: spent };
                }
                await settleFailure(job, err, { state, confirmed });
                return { jobId: job.id, state, chunks, subrequests: spent };
            }

            // decides what happens to the job after an error; never throws, so the cron run always finishes
            async function settleFailure(failed: StoredYouTubeUpload, err: unknown, at: { state: YouTubeUploadState; confirmed: number }): Promise<void> {
                const message = (err as Error).message ?? String(err);
                const kind = err instanceof GoogleApiError
                    ? classifyGoogleFailure(err.httpStatus, err.googleReason)
                    : err instanceof UpstreamTimeoutError || err instanceof DatabaseError || (err instanceof UpstreamError && err.reason === 'unreachable')
                        ? 'transient'
                        : 'permanent';
                log.warn('youtube upload step failed', { jobId: failed.id, kind, ...errorFields(err) });
                try {
                    if (kind === 'quota') {
                        await release({ state: 'waiting_quota', nextAttemptAt: nextPacificMidnight().toISOString(), lastError: 'YouTube\'s daily allowance is used up; the upload continues after midnight Pacific time.' });
                    } else if (kind === 'reconnect') {
                        await connections.markNeedsReconnectById(failed.connectionId);
                        await release({ state: 'needs_reconnect', lastError: 'Google no longer accepts this channel\'s sign-in. Choose Verify again on the channel on the Accounts page.' });
                    } else if (kind === 'session_gone') {
                        // with every byte sent the video may exist; a person checks before a second upload
                        if (at.confirmed >= failed.sourceBytes) await release({ state: 'needs_review', lastError: LOST_ANSWER });
                        else await release({ state: 'queued', sessionUri: null, bytesConfirmed: 0, nextAttemptAt: new Date().toISOString(), lastError: 'The upload address expired; the upload starts again.' });
                    } else if (kind === 'transient') {
                        const attempts = failed.attempts + 1;
                        if (attempts >= MAX_UPLOAD_ATTEMPTS) await release({ state: 'failed', attempts, lastError: `Stopped after ${attempts} tries: ${message}` });
                        else await release({ state: at.state === 'queued' ? 'queued' : at.state, attempts, nextAttemptAt: new Date(Date.now() + retryDelayMs(attempts)).toISOString(), lastError: message });
                    } else {
                        await release({ state: 'failed', attempts: failed.attempts + 1, lastError: message });
                    }
                } catch (saveErr) {
                    // the lease runs out and the next run picks the job up again
                    log.error('youtube upload outcome could not be saved', { jobId: failed.id, ...errorFields(saveErr) });
                }
            }
        },
    };
}

