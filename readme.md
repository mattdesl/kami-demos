## browse source code

- [basic](src/basic) - sprite rendering
- [assets](src/assets) - asset preloading
- [shaders](src/shaders) - including GLSL source in your game
- [shockwave](src/shockwave) - a shockwave shader example, using post-processing

## running the demos



## modifying & building the demos

[Install node.js](http://nodejs.org/), it should come bundled with NPM. Then `cd` to this directory and run the following:

```
npm install
npm build.js
```

This will write the compiled HTML and JS files to the `release` folder. Then you should serve up the `release` folder and browse it on your localhost. To watch the source folder for changes, you can use nodemon and the following command:

```
nodemon --watch src -e js,html,vert,frag build.js
```