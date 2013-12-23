## kami demos

Here is a collection of demos for Kami, a minimal WebGL 2D framework.

## the demos

- [normals](http://mattdesl.github.io/kami-demos/release/normals.html) - normal-mapped 2D images
- [normals-pixel](http://mattdesl.github.io/kami-demos/release/normals-pixel.html) - retro graphics with normal maps
- [basic](http://mattdesl.github.io/kami-demos/release/basic.html) - sprite rendering
- [assets](http://mattdesl.github.io/kami-demos/release/assets.html) - asset preloading
- [shaders](http://mattdesl.github.io/kami-demos/release/shaders-brfs.html) - some approaches to including GLSL code
- [shockwave](http://mattdesl.github.io/kami-demos/release/shockwave.html) - a shockwave shader example, using post-processing

## browse source code

See the [src](src/) folder for the code.

## modifying & building the demos

[Install node.js](http://nodejs.org/), it should come bundled with NPM. Then `cd` to this directory and run the following to build the demos:

```
npm install
node build
```

This will write HTML and JS files to the `release` folder. Then you should serve up the `release` folder and browse it on your localhost. To watch the source folder for changes, you can use nodemon and the following command:

```
nodemon --watch src -e js,html,vert,frag build.js
```