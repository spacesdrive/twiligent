# README media

The GIFs in this folder are the recordings on the repository's front page. Each shows a real page of the app, rendered from the app's own components, with a made-up brand (Northwind Kitchen) and made-up numbers. No real account data is in them.

They were recorded with [Flute](https://github.com/webprodigies-org/flute), which films a React page as a 3D camera move, then exported at 1440x900 and 30 frames a second and turned into GIFs with FFmpeg:

```bash
ffmpeg -i overview.mp4 -vf "setpts=0.67*PTS,fps=12,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" -loop 0 overview.gif
```

Keep each GIF under about 6 MB, so the front page loads quickly. When a page changes enough that its recording looks out of date, record it again the same way.
