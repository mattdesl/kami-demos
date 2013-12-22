var domready = require('domready');

var WebGLContext = require('kami').WebGLContext;
var Texture = require('kami').Texture;
var SpriteBatch = require('kami').SpriteBatch;

domready(function() {
    //Create a new WebGL canvas with the given size
    var context = new WebGLContext(500, 500);

    //the 'view' is the DOM canvas, so we can just append it to our body
    document.body.appendChild( context.view );

    //We use SpriteBatch to draw textures as 2D quads
    var batch = new SpriteBatch(context);
    
    //Here we create a new texture.
    //Notice that the texture isn't valid until it's loaded,
    //so we pass the render() function as the load success callback
    var texture = new Texture(context, "img/scene.png", render);

    //Set bilinear filtering. Kami aliases some GLenums for you, for convenience
    texture.setFilter(Texture.Filter.LINEAR);

    function render() {
        //get the GL rendering context
        var gl = context.gl;

        //clear the context
        gl.clear(gl.COLOR_BUFFER_BIT);

        //draw our image to the size of the canvas
        batch.begin();
        batch.draw(texture, 0, 0, context.width, context.height);
        batch.end(); 
    }
});