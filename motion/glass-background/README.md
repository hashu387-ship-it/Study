# Glass background loop

Made with HeyGen HyperFrames. Each file is a HyperFrames composition: a 12-second seamless
loop of the four section colours drifting under a light sheen, with no text or audio.

- `landscape.html` renders 1920x1080 for laptops and tablets.
- `portrait.html` renders 1080x1920 for phones.

To re-render, put both files (and `gsap.min.js`) in a HyperFrames project and run
`npx hyperframes render --quality looks`. The app serves compressed copies from
`public/motion/` (WebM first, MP4 for older iPhones, JPG as the still frame).
