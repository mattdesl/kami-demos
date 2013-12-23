var CompressedTexture = require('./CompressedTexture');

//This is a "loader plugin" for the asset loader of kami-assets
//It returns an object with 'value', which will be the return value 
//of calls to AssetLoader.add(), and 'load', which is a function which
//handles the async load of the resource. This function is bound to the
//AssetLoader, which in the case of kami-assets, has a reference to the WebGLContext.
function CompressedTextureLoader(name, path, texture, format) {
    path = path || name;
    texture = texture || new CompressedTexture(this.context);
    
    return {

        value: texture,

        load: function(onComplete, onError) {
            //Unfortunately webgl-texture-utils doesn't give us error handling
            texture.setup(path, onComplete, format);
        }
    }
}

//Expected formats
CompressedTextureLoader.extensions = ["tga", "crn", "dds"];

module.exports = CompressedTextureLoader;