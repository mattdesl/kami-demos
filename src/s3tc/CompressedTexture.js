var Texture = require('kami').Texture;
var Class = require('klasse');

var CompressedTexture = new Class({
    
    Extends: Texture,

    /**
     * Loads a new compressed texture asynchronously. This uses webgl-texture-utils
     * to support TGA, DDS and CRN (Crunch). 
     *
     * This is a basic implementation. Properties like minFilter, magFilter,
     * wrapS, and wrapT are not provided to us by Toji's texture loader. 
     *
     * If the format is not defined, it will try to extract it from the path URL.
     * 
     * @param  {WebGLContext} context     the Kami context
     * @param  {String}   path            the path to the image
     * @param  {Function} success         the callback to be called on success
     * @param  {String}   format          the format, TGA, DDS or CRN
     */
    initialize: function CompressedTexture(context, path, success, format) {
        //Pass the arguments object directly. This way, if no arguments are 
        //received here, then Texture will also receive a zero-length array of arguments.
        Texture.apply(this, arguments); 
    },

    __handleCallback: function(success, texture, width, height) {
        this.id = texture;
        this.width = width;
        this.height = height;
        if (typeof success === "function")
            success();
    },

    setup: function(path, success, format) {
        this.width = 0;
        this.height = 0;
        this.id = this.textureLoader.load(path, this.__handleCallback.bind(this, success), format);
    },

    create: function() {
        //This function gets called every time context is restored.
        //The function needs to re-assign the GL object since the old
        //one is no longer usable. 
        this.gl = this.context.gl;

        //since the texture loader does createTexture() and sets parameters,
        //we won't do them in this method.
        this.textureLoader = new TextureUtil.TextureLoader(this.gl);

        //The Texture constructor saves its original arguments, so
        //that we can pass them along to setup() on context restore events
        if (this.managedArgs.length !== 0) {
            this.setup.apply(this, this.managedArgs);
        }
    }
});

module.exports = CompressedTexture;