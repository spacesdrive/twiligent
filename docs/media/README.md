# README media

The animated WebP files in this folder are the recordings on the repository's front page. Each shows a real page of the app, rendered from the app's own components, with a made-up brand (Northwind Kitchen) and made-up numbers. No real account data is in them.

They were recorded with [Flute](https://github.com/webprodigies-org/flute), which films a React page as a 3D camera move, then exported at 1440x900 and 30 frames a second and turned into animated WebP with FFmpeg:

```bash
ffmpeg -i overview.mp4 -vf "setpts=0.67*PTS,fps=15,scale=720:-1:flags=lanczos" -c:v libwebp_anim -lossless 0 -q:v 75 -compression_level 6 -loop 0 -an overview.webp
```

They are WebP rather than GIF because GitHub shows animated WebP in a README like any image, and the same recording is about a fifth of the size with full colour instead of a 256 colour palette. GitHub does not play video files from the repository in a README, so a video is not an option.

Keep each file under about 1.5 MB and the set under about 10 MB, so the front page loads quickly. When a page changes enough that its recording looks out of date, record it again the same way.
