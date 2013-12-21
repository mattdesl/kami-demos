## running the demos

[Install node.js](http://nodejs.org/) and it should come bundled with NPM. Also [see here](http://howtonode.org/introduction-to-npm) to set up owner rights correctly and avoid `sudo`.

Before you run the demos, you need the following global tools. These only need to be installed once:

```
npm install beefy -g
npm install browserify -g
```

To run the demos, cd to this directory (`kami-demos`) and run the following:

```
beefy main.js --cwd path/to/demo --live
```

Then open [http://localhost:9966/](http://localhost:9966/) in your favourite browser. You can download the [Live Reload](http://feedback.livereload.com/knowledgebase/articles/86242-how-do-i-install-and-use-the-browser-extensions-) plugins if you want the demos to be able to reload the browser page when you modify them.

See the demo folders for more specific instructions.

## contents

- [basic](#basic) - sprite rendering
- [assets](#assets) - asset preloading
- [shaders](#shaders) - including GLSL source in your game
- [shockwave](demos/shockwave) - a shockwave shader example, using post-processing
