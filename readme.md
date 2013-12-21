## running the demos

[Install node.js](http://nodejs.org/) and it should come bundled with NPM. Also set up owner rights so you can avoid `sudo`: [see here](http://howtonode.org/introduction-to-npm).

Before you run the demos, you need the following global tools. These only need to be installed once:

```
npm install beefy -g
npm install browserify -g
```

To run the demos, use the following command _from the root directory_ of this repo:

```
beefy main.js --cwd path/to/demo --live
```

Then open [http://localhost:9966/](http://localhost:9966/) in your favourite browser. You can download the [Live Reload](http://feedback.livereload.com/knowledgebase/articles/86242-how-do-i-install-and-use-the-browser-extensions-) plugins if you want the demos to be able to reload the browser page when you modify them.

See the demo folder for more specific instructions.

## contents

- [basic](#basic) - sprite rendering
- [assets](#assets) - asset preloading
- [shaders](#shaders) - including GLSL source in your game
- [shockwave](#shockwave) - a shockwave shader example, using post-processing


## demos/shaders

A couple of different approaches to including shaders in your app.

#### script-tag

This is the classic `<script>` tag approach.

```
beefy main.js --cwd demos/shaders/script-tag --live
```

#### brfs

This uses a browserify transform to bake in the GLSL code at build-time. This is awesome if you are using browserify, but not so awesome if you aren't using browserify. Make sure you include the brfs transform when running the demo:

```
beefy main.js --cwd demos/shaders/brfs --live -- -t brfs
```

A more advanced approach would be to use [glsify](https://github.com/chrisdickinson/glslify) to modularize your GLSL code.

#### inline strings

I didn't include a demo for this since it's not much different. You just inline your GLSL code [like this](http://stackoverflow.com/a/805755) in your source files. It gets pretty ugly  in certain cases it might be a good option.