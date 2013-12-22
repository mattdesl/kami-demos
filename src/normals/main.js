var domready = require('domready');

var WebGLContext = require('kami').WebGLContext;
var Texture = require('kami').Texture;
var SpriteBatch = require('kami').SpriteBatch;
var ShaderProgram = require('kami').ShaderProgram;
var fs = require('fs');

//include polyfill for requestAnimationFrame
require('raf.js');

var vert = fs.readFileSync( __dirname + "/lighting.vert" );
var frag = fs.readFileSync( __dirname + "/lighting.frag" );

function addCredits() {
    var text = document.createElement("div");
    text.className = "credits";
    text.innerHTML = 'brick wall texture and normal map by <a href="http://opengameart.org/content/brick-wall">JosipKladaric</a>';
    document.body.appendChild(text);
}

domready(function() {
    //Create a new WebGL canvas with the given size
    var context = new WebGLContext(window.innerWidth, window.innerHeight);

    //the 'view' is the DOM canvas, so we can just append it to our body
    document.body.appendChild( context.view );
    document.body.style.overflow = "hidden";
    document.body.style.margin = "0";

    addCredits();

    //We use SpriteBatch to draw textures as 2D quads
    var batch = new SpriteBatch(context);
    
    var texDiffuse = new Texture(context, "img/brick-diffuse.png");
    var texNormal  = new Texture(context, "img/brick-normals.png");

    //set the filters for our textures
    texNormal.setWrap(Texture.Wrap.REPEAT);
    texNormal.setFilter(Texture.Filter.LINEAR);

    texDiffuse.setWrap(Texture.Wrap.REPEAT);    
    texDiffuse.setFilter(Texture.Filter.LINEAR);

    //setup our shader
    var shader = new ShaderProgram(context, vert, frag);
    if (shader.log)
        console.warn(shader.log);

    //notice how we bind our shader before setting uniforms!
    shader.bind();
    shader.setUniformi("u_normals", 1);

    //parameters for the lighting shader
    var ambientColor = new Float32Array([0.0, 0.0, 0.0, 0.2]);

    //the default light Z position
    var lightZ = 0.075;

    //these parameters are per-light
    var lightColor = new Float32Array(
            [1.0, 1.0, 1.0, 1.0,
             0.6, 0.8, 0.5, 0.5]);
    var falloff = new Float32Array(
            [0.4, 7.0, 40.0,
             0.2, 1.0, 40.0]);
    var lightPos = new Float32Array(
            [0, 0, lightZ,
             0, 0, lightZ]);

    var mouseX = 0, 
        mouseY = 0
        scroll = 0,
        time   = 0;

    window.addEventListener("mousemove", function(ev) {
        mouseX = ev.pageX / context.width;
        mouseY = 1.0 - ev.pageY / context.height;
    }, true);

    window.addEventListener("resize", function(ev) {
        context.resize(window.innerWidth, window.innerHeight);
    }, true);

    var lastTime = 0,
        now = Date.now();

    function render() {
        requestAnimationFrame(render);
        
        //get delta time for smooth animation
        now = Date.now();
        var delta = (now - lastTime) / 1000;
        lastTime = now;

        var gl = context.gl;


        //animate the camera by scrolling UV offsets
        time += 0.25 * delta;

        //we can scale the coordinates to create a "zoom"        
        var zoom = 1 - ( (Math.sin(time) / 2 + 0.5) * 0.15 );

        //determine how many repeats we need to fit nicely within the window 
        var xrepeats = (context.width / texDiffuse.width) * zoom;
        var yrepeats = (context.height / texDiffuse.height) * zoom;

        //now offset the position of the UVs with some sin magic
        var xpos = -xrepeats + Math.sin(Math.sin(time*0.5)), 
            ypos = -yrepeats + Math.sin(time*0.25);




        //get the GL rendering context
        var gl = context.gl;

        //clear the context
        gl.clear(gl.COLOR_BUFFER_BIT);
        
        //we need to set the shader of our batch...
        batch.shader = shader;

        //make sure our batch is oriented with the window size
        batch.resize(window.innerWidth, window.innerHeight);

        //draw our image to the size of the canvas
        //this will bind our shader
        batch.begin();

        //the first light will be based on mouse
        lightPos[0] = mouseX;
        lightPos[1] = mouseY;

        //the second light we'll just move around a bit
        lightPos[3] = (Math.sin(time*0.25) / 2.0 + 0.5);
        lightPos[4] = (Math.sin(time*0.75) / 2.0 + 0.5);

        //pass our parameters to the shader
        shader.setUniformf("Resolution", context.width, context.height);
        shader.setUniformfv("AmbientColor", ambientColor);

        //note that these are arrays, and we need to explicitly say the component count
        shader.setUniformfv("LightPos[0]", lightPos, 3);
        shader.setUniformfv("Falloff[0]", falloff, 3);
        shader.setUniformfv("LightColor[0]", lightColor, 4);

        texNormal.bind(1);  //bind normals to unit 1
        texDiffuse.bind(0); //bind diffuse to unit 0

        

        batch.draw(texDiffuse, 0, 0, context.width, context.height,
                               xpos, ypos, xpos+xrepeats, ypos+yrepeats);
            
        batch.end(); 
    }

    requestAnimationFrame(render);
});