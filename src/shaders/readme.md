# shaders

Here we demonstrate a couple different ways of including GLSL source code into your app, and using a custom shader with SpriteBatch and Kami. 

## script-tag

This approach uses a `<script>` tag to hold the content of the vertex and fragment shaders:

```html
<script id="frag_shader" type="x-shader/x-fragment">
    ... fragment shader code here ....
</script>
```

The contents are then queried with:

```js
fragSource = document.getElementById("frag_shader").innerHTML

// or with jQuery
fragSource = $("#frag_shader").html();
```

## brfs

This approach uses a browserify transform to decouple the GLSL source from your HTML/JS source. The GLSL is inlined into your JS files during build-time, so there is no extra overhead. Make sure you include the brfs transform when running the demo:

From your app, the code looks like this:

```js
var fs = require('fs'); 

var vertSource = fs.readFileSync( __dirname + "/myShader.vert" );
```

A more advanced approach would be to use [glsify](https://github.com/chrisdickinson/glslify) to modularize your GLSL code.

## inline strings

I didn't include a demo for this since it's not much different. You just inline your GLSL code [like this](http://stackoverflow.com/a/805755) in your source files. It gets pretty ugly  in certain cases it might be a good option.