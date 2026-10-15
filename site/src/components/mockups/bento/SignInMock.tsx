import { useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/cn';
import { useAutoplay } from '@/hooks/useAutoplay';
import { CheckCircle, Login } from '@/components/icons';
import { Mark } from '@/components/brand';
import { Cursor } from '../Cursor';
import { Typed } from '../Typed';
import { Frame } from './Frame';

const STEPS = [0.6, 0.7, 1.7, 0.7, 0.5, 1.9, 2.6];
const PHASE = { atEmail: 1, email: 2, atSend: 3, send: 4, code: 5, done: 6 } as const;
const CODE = ['4', '8', '1', '9', '2', '7'];
const EMAIL = 'asha@northwind.kitchen';
const ENTER = [0.16, 1, 0.3, 1] as const;
const SWAP = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.28, ease: ENTER },
};

// signing in with an email: the address typed, Send code clicked, the six digits arriving, then signed in
export function SignInMock() {
  const ref = useRef<HTMLDivElement>(null);
  const { phase, loop, reduce } = useAutoplay(ref, STEPS);
  const codeView = phase >= PHASE.send;
  const target = reduce
    ? null
    : phase === PHASE.atEmail || phase === PHASE.email
      ? 'email'
      : phase === PHASE.atSend || phase === PHASE.send
        ? 'send'
        : null;
  const clicks = loop * 2 + (phase >= PHASE.email ? 1 : 0) + (phase >= PHASE.send ? 1 : 0);

  return (
    <Frame
      ref={ref}
      label="Signing in to Twiligent: continue with Google, or type an email, get a 6-digit code and enter it."
      icon={<Login className="size-5" />}
      title="Sign in"
      meta={<span className="font-mono text-[11px] text-ink-muted">app.twiligent.ujjwal.fyi</span>}
      bodyClassName="flex flex-col items-center px-6 pt-5"
      overlay={<Cursor stage={ref} target={target} clicks={clicks} />}
    >
      <Mark className="h-8" />
      <p className="mt-3 font-display text-base font-semibold text-ink">Sign in to Twiligent</p>
      <div className="relative mt-4 w-full max-w-[18rem] flex-1">
        <AnimatePresence mode="wait" initial={false}>
          {codeView ? (
            <motion.div key={`code-${loop}`} className="flex flex-col items-center" {...SWAP}>
              <p className="text-center text-[11px] text-ink-muted">
                Enter the code sent to <span className="text-ink">{EMAIL}</span>
              </p>
              <div className="mt-3 flex w-full justify-between gap-1.5">
                {CODE.map((digit, i) => {
                  const filled = phase >= PHASE.done || (phase === PHASE.code && !reduce);
                  return (
                    <span
                      key={i}
                      className={cn(
                        'grid h-11 flex-1 place-items-center rounded-md border font-mono text-base text-ink',
                        phase >= PHASE.done ? 'border-success/60' : 'border-line',
                      )}
                    >
                      {filled && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.6 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{
                            duration: 0.24,
                            ease: ENTER,
                            delay: phase === PHASE.code ? 0.15 + i * 0.22 : 0,
                          }}
                        >
                          {digit}
                        </motion.span>
                      )}
                    </span>
                  );
                })}
              </div>
              <AnimatePresence>
                {phase >= PHASE.done && (
                  <motion.p
                    className="mt-4 flex items-center gap-1.5 text-[13px] font-semibold text-success"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: ENTER }}
                  >
                    <CheckCircle className="size-4" />
                    Signed in
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div key={`email-${loop}`} className="flex flex-col" {...SWAP}>
              <span className="flex h-10 items-center justify-center rounded-full border border-line text-[13px] font-medium text-ink">
                Continue with Google
              </span>
              <p className="my-2.5 text-center text-[10px] font-semibold tracking-widest text-ink-muted uppercase">
                or
              </p>
              <span
                data-cursor="email"
                className={cn(
                  'flex h-10 items-center rounded-md border px-3 text-[13px] transition-colors duration-300',
                  phase >= PHASE.email ? 'border-ink-muted/60 text-ink' : 'border-line text-ink-muted',
                )}
              >
                {phase >= PHASE.email ? <Typed key={loop} text={EMAIL} active speed={22} /> : 'Email'}
              </span>
              <span
                data-cursor="send"
                className={cn(
                  'mt-2.5 flex h-10 items-center justify-center rounded-full text-[13px] font-semibold transition-colors duration-300',
                  phase >= PHASE.atSend ? 'bg-accent text-on-accent' : 'bg-surface-sunken text-ink-muted',
                )}
              >
                Send code
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Frame>
  );
}
