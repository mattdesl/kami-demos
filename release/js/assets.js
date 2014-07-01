(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*!
  * domready (c) Dustin Diaz 2012 - License MIT
  */
!function (name, definition) {
  if (typeof module != 'undefined') module.exports = definition()
  else if (typeof define == 'function' && typeof define.amd == 'object') define(definition)
  else this[name] = definition()
}('domready', function (ready) {

  var fns = [], fn, f = false
    , doc = document
    , testEl = doc.documentElement
    , hack = testEl.doScroll
    , domContentLoaded = 'DOMContentLoaded'
    , addEventListener = 'addEventListener'
    , onreadystatechange = 'onreadystatechange'
    , readyState = 'readyState'
    , loadedRgx = hack ? /^loaded|^c/ : /^loaded|c/
    , loaded = loadedRgx.test(doc[readyState])

  function flush(f) {
    loaded = 1
    while (f = fns.shift()) f()
  }

  doc[addEventListener] && doc[addEventListener](domContentLoaded, fn = function () {
    doc.removeEventListener(domContentLoaded, fn, f)
    flush()
  }, f)


  hack && doc.attachEvent(onreadystatechange, fn = function () {
    if (/^c/.test(doc[readyState])) {
      doc.detachEvent(onreadystatechange, fn)
      flush()
    }
  })

  return (ready = hack ?
    function (fn) {
      self != top ?
        loaded ? fn() : fns.push(fn) :
        function () {
          try {
            testEl.doScroll('left')
          } catch (e) {
            return setTimeout(function() { ready(fn) }, 50)
          }
          fn()
        }()
    } :
    function (fn) {
      loaded ? fn() : fns.push(fn)
    })
})

},{}],2:[function(require,module,exports){
//This is an asset loader queue tailored for Kami/WebGL

var LoaderBase = require('assetloader');
var Class = require('klasse');
var Texture = require('kami').Texture;

//this is a kami-specific loader for a Texture object
//it is assumed that the AssetManager being passed is a WebGLContext
function TextureLoader(name, path, texture, genMipmaps) {
    path = path || name;

    texture = texture || new Texture(this.context);
    
    return {

        value: texture,

        load: function(onComplete, onError) {
            //Texture has a handy function for this sort of thing...
            texture.setup(path, onComplete, onError, genMipmaps);
        }
    }
}

//Setup loader parameters
TextureLoader.extensions = ["png", "gif", "jpg", "jpeg"];
TextureLoader.mediaType = "image";

var AssetLoader = new Class({

    Extends: LoaderBase,

    initialize: function(context) {
        LoaderBase.call(this);

        if (!context || typeof context !== "object")
            throw "Kami AssetLoader must be passed with a valid WebGLContext";

        this.registerLoader(TextureLoader);

        this.context = context;
        this.__invalidateFunc = this.invalidate.bind(this);
        this.context.restored.add( this.__invalidateFunc );
    },

    destroy: function() {
        this.context.restored.remove(this.__invalidateFunc);
    }
});

//Copy static attributes ...
AssetLoader.Status = LoaderBase.Status;

AssetLoader.registerCommonLoader = LoaderBase.registerCommonLoader;

AssetLoader.Descriptor = LoaderBase.Descriptor;

AssetLoader.TextureLoader = TextureLoader;

module.exports = AssetLoader;








/// old docs. 

    /**
     * This is the loading function of a AssetManager plugin, 
     * which handles the asynchronous loading for an asset. 
     * The function must be implemented in a very
     * strict manner for the asset manager to work correctly.
     *
     * Once the async loading is done, you must call the `finished` callback
     * that was passed to this method. You can pass the parameter `false` to the
     * finished callback to indicate the async load has failed. Otherwise, it is assumed
     * to be successful.
     * 
     * If you don't invoke the callback, the asset manager may never finish loading.
     * 
     * @param  {String} name the name of the asset to load
     * @param {Function} finished the function to call when async loading is complete
     * @param {Texture} texture the texture to operate on for this asset
     * @param {String} path the optional image path to use instead of the `name` parameter
     */
/**
 * This is the default implementation of an image loader plugin for AssetManager.
 * This uses a DOM Image object to upload PNG, GIF and JPG images to a WebGL
 * texture. You will not need to deal with this class directly, unless you want
 * to write your own AssetManager loaders.
 *
 * A Loader plugin is a class which handles the asynchronous loading and provides
 * a convenient return value for the `AssetManager.load()` functions. The loader class
 * is constructed with the following parameters: first, the WebGLContext this AssetManager
 * is using, and second, the name of the asset to be loaded. The subsequent arguments are
 * those that were passed as extra to the `AssetManager.load()` functions.
 *
 * A loader must implement a `load()` function, and it's encouraged to also implement a 
 * `getReturnValue()` function, for convenience.
 * 
 * @param {WebGLContext} context the context, passed by AssetManager
 * @param {String} name the unique key for this asset
 * @param {String} path the optional path or data URI to use, will default to the name param
 * @param {Texture} texture an optional texture to act on; if undefined, a new texture
 *                          will be created
 */
},{"assetloader":4,"kami":14,"klasse":17}],3:[function(require,module,exports){
//this is a generic loader for Image objects
//e.g. with HTML or 2D Canvas
function ImageLoader(name, path) {
	path = path || name;
	var img = new Image();

	return {
		
		value: img,

		load: function(onComplete, onError) {
			img.onload = function() {
				img.onerror = img.onabort = null; //clear other listeners
				onComplete();
			};
			img.onerror = function() {
				img.onload = img.onabort = null;
				console.warn("Error loading image: "+path);
				onError();
			};
			img.onabort = function() {
				img.onload = img.onerror = null;
				console.warn("Aborted image: "+path);
				onError();
			};
			//setup source
			
			img.src = path;
		}
	};
}

ImageLoader.extensions = ["png", "gif", "jpg", "jpeg"];

ImageLoader.mediaType = "image";

module.exports = ImageLoader;
},{}],4:[function(require,module,exports){
var Class = require('klasse');
var Signal = require('signals');
var ImageLoader = require('./ext/ImageLoader');

function registerLoader(loaders, loaderFunc, extensions, mediaType) {
	if (!loaderFunc || !extensions || !extensions.length)
		throw "must specify at least one extension for the loader";
	
	for (var i=0; i<extensions.length; i++) {
		loaders[ extensions[i] ] = loaderFunc;
		if (mediaType) 
			loaders[ mediaType + '/' + extensions[i] ] = loaderFunc;
	}
}

/**
 * This is a base class for asset management; ideal for either
 * generic HTML5 2D canvas or WebGL canvas.
 * 
 * @class  AssetLoader
 * @constructor 
 */
var AssetLoader = new Class({
	
	/**
	 * A read-only property that describes the number of 
	 * assets remaining to be loaded.
	 *
	 * @property remaining
	 * @type {Number}
	 * @readOnly
	 */
	remaining: {
		get: function() {
			return this.__loadCount;
		}
	},

	/**
	 * A read-only property that descriibes the total
	 * number of assets in this AssetLoader.
	 * 
	 * @property total
	 * @readOnly
	 * @type {Number}
	 */
	total: {
		get: function() {
			return this.__totalItems;
		}
	},

	/**
	 * A convenience read-only getter for the current progress,
	 * which is the same as total - remaining.
	 * 
	 * @property current
	 * @readOnly
	 * @type {Number}
	 */
	current: {
		get: function() {
			return this.total - this.remaining;
		}
	},

	//Constructor
	initialize: function AssetLoader() {

		/**
		 * An array of Descriptors that this queue is handling.
		 * This should not be modified directly.
		 * 
		 * @property assets
		 * @type {Array}
		 */
		this.assets = [];

		/**
		 * The queue of tasks to load. Each contains
		 * an
		 * {{#crossLink "AssetLoader.Descriptor"}}{{/crossLink}}.
		 *
		 * Loading a task will pop it off this list and fire the async
		 * or synchronous process.
		 *
		 * This should not be modified directly.
		 *
		 * @property tasks
		 * @protected
		 * @type {Array}
		 */
		this.tasks = [];

		//Private stuff... do not touch!

		this.__loadCount = 0;
		this.__totalItems = 0;

		// Signals 
		
		/**
		 * A signal dispatched when loading first begins, 
		 * i.e. when update() is called and the loading queue is the
		 * same size as the total asset list.
		 *
		 * @event loadStarted
		 * @type {Signal}
		 */
		this.loadStarted = new Signal();

		/**
		 * A signal dispatched when all assets have been loaded
		 * (i.e. their async tasks finished).
		 *
		 * @event loadFinished
		 * @type {Signal}
		 */
		this.loadFinished = new Signal();

		/**
		 * A signal dispatched on progress updates, once an asset
		 * has been loaded in full (i.e. its async task finished).
		 *
		 * This passes an event object to the listener function
		 * with the following properties:
		 * 
		 * - `current` number of assets that have been loaded
		 * - `total` number of assets to loaded
		 * - `name` of the asset which was just loaded
		 *  
		 * @event loadProgress
		 * @type {[type]}
		 */
		this.loadProgress = new Signal();

		/**
		 * A signal dispatched on problematic load; e.g. if
		 * the image was not found and "onerror" was triggered. 
		 * The first argument passed to the listener will be 
		 * the string name of the asset.
		 *
		 * The asset manager will continue loading subsequent assets.
		 *
		 * This is dispatched after the status of the asset is
		 * set to Status.LOAD_FAIL, and before the loadProgress
		 * signal is dispatched.
		 *
		 * @event loadError
		 * @type {Signal}
		 */
		this.loadError = new Signal();


		/**
		 * A set of loader plugins for this asset manager. These might be as simple
		 * as pushing HTML Image objects into a Texture, or more complex like decoding
		 * a compressed, mip-mapped, or cube-map texture.
		 *
		 * This object is a simple hashmap of lower-case extension names to Loader functions,
		 * and mime-types like "image/png" for data URIs.
		 * 
		 * @property loaders
		 * @type {Object}
		 */
		this.loaders = {};

		//copy from our common loaders
		for (var k in AssetLoader.commonLoaders) {
			if (AssetLoader.commonLoaders.hasOwnProperty(k)) {
				this.loaders[k] = AssetLoader.commonLoaders[k];
			}
		}

		//We register the image loader by default
		this.registerLoader(ImageLoader);
	},

	/**
	 * Destroys this asset manager; deleting the tasks
	 * and assets arrays and resetting the load count.
	 * 
	 * @method  destroy
	 */
	destroy: function() {
		this.removeAll();
	},

	/**
	 * Called to invalidate the asset manager
	 * and require all assets to be re-loaded.
	 * For example, a WebGL app will call this internally
	 * on context loss.
	 *
	 * @protected
	 * @method invalidate
	 */
	invalidate: function() {
		//mark all as not yet loaded
		for (var i=0; i<this.assets.length; i++) {
			this.assets[i].status = AssetLoader.Status.QUEUED;
		}
		
		//copy our assets to a queue which can be popped
		this.tasks = this.assets.slice();

		this.__loadCount = this.__totalItems = this.tasks.length;
	},

	/**
	 * Attempts to extract a mime-type from the given data URI. It will
	 * default to "text/plain" if the string is a data URI with no specified
	 * mime-type. If the string does not begin with "data:", this method 
	 * returns null.
	 *
	 * @method  __getDataType
	 * @private
	 * @param  {String} str the data URI
	 * @return {String}     the mime type
	 */
	__getDataType: function(str) {
		var test = "data:";
		//starts with 'data:'
		var start = str.slice(0, test.length).toLowerCase();
		if (start == test) {
			var data = str.slice(test.length);
			
			var sepIdx = data.indexOf(',');
			if (sepIdx === -1) //malformed data URI scheme
				return null;

			//e.g. "image/gif;base64" => "image/gif"
			var info = data.slice(0, sepIdx).split(';')[0];

			//We might need to handle some special cases here...
			//standardize text/plain to "txt" file extension
			if (!info || info.toLowerCase() == "text/plain")
				return "txt"

			//User specified mime type, try splitting it by '/'
			return info.split('/').pop().toLowerCase();
		}
		return null;
	},

	__extension: function(str) {
		var idx = str.lastIndexOf('.');
		if (idx === -1 || idx === 0 || idx === str.length-1) // does not have a clear file extension
			return "";
		return str.substring(idx+1).toLowerCase();
	},

	/**
	 * Returns the AssetDescriptor by name, or null if not found.
	 * 
	 * @method  getDescriptor
	 * @protected
	 * @param  {AssetDescriptor} name the name of the asset
	 * @return {any}      the asset
	 */
	getDescriptor: function(name) {
		var idx = this.indexOf(this.assets, name);
		return idx !== -1 ? this.assets[idx] : null;
	},

	getStatus: function(name) {
		var d = this.getDescriptor(name);
		return d ? d.status : null;
	},
	
	isLoaded: function(name) {
		return this.getStatus(name) === AssetLoader.Status.LOAD_SUCCESS;
	},
	
	/**
	 * Returns the value stored for this asset, such as an Image
	 * if we are using a Canvas image loading plugin. Returns null
	 * if the asset was not found.
	 * 	
	 * @param  {String} name the name of the asset to get
	 * @return {any}    the asset by name
	 */
	get: function(name) {
		var d = this.getDescriptor(name);
		return d ? d.value : null;
	},

	/**
	 * Removes a reference to the given asset, and returns the removed
	 * asset. If the asset by name was not found, null is returned.
	 *
	 * This will also remove the asset from the task list.
	 *
	 * Note that this will not destroy any resources that asset maintained;
	 * so it is the user's duty to do so after removing it from the queue.
	 * 
	 * @param  {[type]} name [description]
	 * @return {[type]}      [description]
	 */
	remove: function(name) {
		var assetIdx = this.indexOf(this.assets, name);
		if (assetIdx === -1)
			return null;

		var asset = this.assets[assetIdx];
		var status = asset.status;

		//let's see.. the asset can either be QUEUED
		//or LOADING, or LOADED (fail/success). if it's queued 

		
		//remove reference to the asset
		this.assets.splice(assetIdx, 1);
		
		//make sure it's not in our task list
		var taskIdx = this.indexOf(this.tasks, name);

		this.__totalItems = Math.max(0, this.__totalItems-1);
		this.__loadCount = Math.max(0, this.__loadCount-1);
		if (taskIdx !== -1) {
			//it's waiting to be loaded... we need to remove it
			//and also decrement the load / total count
			this.tasks.splice(taskIdx, 1);
		} else {
			//not in tasks... already queued
			
		}

		if (this.__loadCount === 0) {
			if (this.loading) {
				this.loadFinished.dispatch({
					current: 0,
					total: 0
				});
			}
			this.loading = false;
		}
		return asset.value;
	},

	removeAll: function() {
		this.assets.length = 0;
		this.tasks.length = 0;
		this.__loadCount = this.__totalItems = 0;

		if (this.loading) {
			this.loadFinished.dispatch({
				current: 0,
				total: 0
			});
		}
		this.loading = false;
	},

	/**
	 * Calls `add()` for each string in the given array.
	 *
	 * @method addAll
	 * @param  {Array} array 
	 */
	addAll: function(array) {
		for (var i=0; i<array.length; i++) {
			this.add(array[i]);
		}
	},

	/**
	 * Pushes an asset onto this stack. This
	 * attempts to detect the loader for you based
	 * on the asset name's file extension (or data URI scheme). 
	 * If the asset name doesn't have a known file extension,
	 * or if there is no loader registered for that filename,
	 * this method throws an error. If you're trying to use 
	 * generic keys for asset names, use the addAs method and
	 * specify a loader plugin.
	 * 
	 * This method's arguments are passed to the constructor
	 * of the loader function. 
	 *
	 * The return value of this method is determined by
	 * the loader's processArguments method. For example, the
	 * default Image loader returns a Texture object.
	 *
	 * @example
	 *    //uses ImageLoader to get a new Texture
	 *    var tex = assets.add("tex0.png"); 
	 *
	 *    //or you can specify your own texture
	 *    assets.add("tex1.png", tex1);
	 *
	 *    //the ImageLoader also accepts a path override, 
	 *    //but the asset key is still "frames0.png"
	 *    assets.add("frame0.png", tex1, "path/to/frame1.png");
	 *    
	 * @method  add
	 * @param  {String} name the asset name
	 * @param  {any} args a variable number of optional arguments
	 * @return {any} returns the best type for this asset's loader
	 */
	add: function(name) {
		if (!name)
			throw "No asset name specified for add()";

		var ext = this.__getDataType(name);
		if (ext === null)
			ext = this.__extension(name);

		if (!ext) 
			throw "Asset name does not have a file extension: " + name;
		if (!this.loaders.hasOwnProperty(ext))
			throw "No known loader for extension "+ext+" in asset "+name;

		var args = [ this.loaders[ext], name ];
		args = args.concat( Array.prototype.slice.call(arguments, 1) );

		return this.addAs.apply(this, args);
	},

	/**
	 * Pushes an asset onto this stack. This allows you to
	 * specify a loader function for the asset. This is useful
	 * if you wish to use generic names for your assets (instead of
	 * filenames), or if you want a particular asset to use a specific
	 * loader. 
	 *
	 * The first argument is the loader function, and the second is the asset
	 * name. Like with {{#crossLink "AssetLoader/load:method"}}{{/crossLink}}, 
	 * any subsequent arguments will be passed along to the loader.
	 *
	 * The return value of this method is determined by
	 * the loader's return value, if it has one. For example, a Canvas ImageLoader
	 * plugin might returnn Image object. This is also the value which can be retrieved with
	 * `get()` or by accessing the `value` of an AssetDescriptor. If the loader function
	 * does not implement a return value, `undefined` is returned. 
	 *
	 * @method  addAs
	 * @param {Fucntion} loader the loader function
	 * @param {String} name the asset name
	 * @param {Object ...} args a variable number of optional arguments
	 * @return {any} returns the best type for this asset's loader
	 */
	addAs: function(loader, name) {
		if (!name)
			throw "no name specified to load";
		if (!loader)
			throw "no loader specified for asset "+name;

		var idx = this.indexOf(this.assets, name);
		if (idx !== -1) //TODO: eventually add support for dependencies and shared assets
			throw "asset already defined in asset manager";

		//grab the arguments, except for the loader function.
		var args = Array.prototype.slice.call(arguments, 1);
		
		//create our loader function and get the new return value
		var retObj = loader.apply(this, args);

		if (typeof retObj.load !== "function")
			throw "loader not implemented correctly; must return a 'load' function";

		//keep hold of this asset and its original name
		var descriptor = new AssetLoader.Descriptor(name, retObj.load, retObj.value);
		this.assets.push( descriptor );

		//also add it to our queue of current tasks
		this.tasks.push( descriptor );
		this.__loadCount++;
		this.__totalItems++;

		return retObj.value;
	},

	indexOf: function(list, name) {
		for (var i=0; i<list.length; i++) {
			if (list[i] && list[i].name === name)
				return i;
		}
		return -1;
	},


	__loadCallback: function(name, success) {
		//if 'false' was passed, use it.
		//otherwise treat as 'true'
		success = success !== false;

		var assetIdx = this.indexOf(this.assets, name);
				
		//If the asset is not found, we can assume it
		//was removed from the queue. in this case we 
		//want to ignore events since they should already
		//have been fired.
		if (assetIdx === -1) {
			return;
		}
		
		this.__loadCount--;

		this.assets[assetIdx].status = success 
						? AssetLoader.Status.LOAD_SUCCESS
						: AssetLoader.Status.LOAD_FAILED;

		var current = (this.__totalItems - this.__loadCount),
			total = this.__totalItems;

		if (!success) {
			this.loadError.dispatch({
				name: name,
				current: current,
				total: total
			});
		}

		this.loadProgress.dispatch({
			name: name,
			current: current,
			total: total
		});
			
		if (this.__loadCount === 0) {
			this.loading = false;
			this.loadFinished.dispatch({
				current: current,
				total: total
			});
		}
	},

	/**
	 * Updates this AssetLoader by loading the next asset in the queue.
	 * If all assets have been loaded, this method returns true, otherwise
	 * it will return false.
	 *
	 * @method  update
	 * @return {Boolean} whether this asset manager has finished loading
	 */
	update: function() {
		if (this.tasks.length === 0)
			return (this.__loadCount === 0);

		//If we still haven't popped any from the assets list...
		if (this.tasks.length === this.assets.length) {
			this.loading = true;
			this.loadStarted.dispatch({
				current: 0,
				total: this.__totalItems
			});
		}

		//grab the next task on the stack
		var nextTask = this.tasks.shift();

		//apply the loading step
		var loader = nextTask.loadFunc;

		var cb = this.__loadCallback.bind(this, nextTask.name, true);
		var cbFail = this.__loadCallback.bind(this, nextTask.name, false);

		//do the async load ...
		loader.call(this, cb, cbFail);

		return (this.__loadCount === 0);
	},

	/**
	 * Registers a loader function for this queue with the given extension(s).
	 * This will override any extensions or mime-types already registered.
	 * 
	 * @method registerLoader
	 * @param {Function} loader the loader function
	 */
	registerLoader: function(loader) {
		registerLoader(this.loaders, loader, loader.extensions, loader.mediaType);
	}
});
	
/**
 * This is a map of "common" loaders, shared by many contexts.
 * For example, an image loader is specific to WebGL, Canvas, SVG, etc,
 * but a JSON loader might be renderer-independent and thus "common". 
 *
 * When a new AssetManager is created, it will use these loaders.
 * 
 * @type {Object}
 */
AssetLoader.commonLoaders = {};

/**
 * Registers a "common" loader function with the given extension(s).
 * 
 * For example, an image loader is specific to WebGL, Canvas, SVG, etc,
 * but a JSON loader might be renderer-independent and thus "common". 
 *
 * When a new AssetManager is created, it will use these loaders.
 * 
 * @method registerCommonLoader
 * @param {Function} loader the loader function
 */
AssetLoader.registerCommonLoader = function(loader) {
	registerLoader(AssetLoader.commonLoaders, loader, loader.extensions, loader.mediaType);
}

/**
 * A simple wrapper for assets which will be passed along to the loader;
 * this is used internally.
 * 
 * //@class AssetLoader.Descriptor
 */
AssetLoader.Descriptor = function(name, loadFunc, value) {
	this.name = name;
	this.loadFunc = loadFunc;
	this.value = value;
	this.status = AssetLoader.Status.QUEUED;
};

/**
 * Defines the status of an asset in the manager queue.
 * The constants under this object are one of:
 * 
 *     QUEUED
 *     LOADING
 *     LOAD_SUCCESS
 *     LOAD_FAIL
 * 
 * @attribute  Status
 * @type {Object}
 */
AssetLoader.Status = {
	QUEUED: "QUEUED",
	LOADING: "LOADING",
	LOAD_SUCCESS: "LOAD_SUCCESS",
	LOAD_FAIL: "LOAD_FAIL"
};

module.exports = AssetLoader;

},{"./ext/ImageLoader":3,"klasse":17,"signals":5}],5:[function(require,module,exports){
/*jslint onevar:true, undef:true, newcap:true, regexp:true, bitwise:true, maxerr:50, indent:4, white:false, nomen:false, plusplus:false */
/*global define:false, require:false, exports:false, module:false, signals:false */

/** @license
 * JS Signals <http://millermedeiros.github.com/js-signals/>
 * Released under the MIT license
 * Author: Miller Medeiros
 * Version: 1.0.0 - Build: 268 (2012/11/29 05:48 PM)
 */

(function(global){

    // SignalBinding -------------------------------------------------
    //================================================================

    /**
     * Object that represents a binding between a Signal and a listener function.
     * <br />- <strong>This is an internal constructor and shouldn't be called by regular users.</strong>
     * <br />- inspired by Joa Ebert AS3 SignalBinding and Robert Penner's Slot classes.
     * @author Miller Medeiros
     * @constructor
     * @internal
     * @name SignalBinding
     * @param {Signal} signal Reference to Signal object that listener is currently bound to.
     * @param {Function} listener Handler function bound to the signal.
     * @param {boolean} isOnce If binding should be executed just once.
     * @param {Object} [listenerContext] Context on which listener will be executed (object that should represent the `this` variable inside listener function).
     * @param {Number} [priority] The priority level of the event listener. (default = 0).
     */
    function SignalBinding(signal, listener, isOnce, listenerContext, priority) {

        /**
         * Handler function bound to the signal.
         * @type Function
         * @private
         */
        this._listener = listener;

        /**
         * If binding should be executed just once.
         * @type boolean
         * @private
         */
        this._isOnce = isOnce;

        /**
         * Context on which listener will be executed (object that should represent the `this` variable inside listener function).
         * @memberOf SignalBinding.prototype
         * @name context
         * @type Object|undefined|null
         */
        this.context = listenerContext;

        /**
         * Reference to Signal object that listener is currently bound to.
         * @type Signal
         * @private
         */
        this._signal = signal;

        /**
         * Listener priority
         * @type Number
         * @private
         */
        this._priority = priority || 0;
    }

    SignalBinding.prototype = {

        /**
         * If binding is active and should be executed.
         * @type boolean
         */
        active : true,

        /**
         * Default parameters passed to listener during `Signal.dispatch` and `SignalBinding.execute`. (curried parameters)
         * @type Array|null
         */
        params : null,

        /**
         * Call listener passing arbitrary parameters.
         * <p>If binding was added using `Signal.addOnce()` it will be automatically removed from signal dispatch queue, this method is used internally for the signal dispatch.</p>
         * @param {Array} [paramsArr] Array of parameters that should be passed to the listener
         * @return {*} Value returned by the listener.
         */
        execute : function (paramsArr) {
            var handlerReturn, params;
            if (this.active && !!this._listener) {
                params = this.params? this.params.concat(paramsArr) : paramsArr;
                handlerReturn = this._listener.apply(this.context, params);
                if (this._isOnce) {
                    this.detach();
                }
            }
            return handlerReturn;
        },

        /**
         * Detach binding from signal.
         * - alias to: mySignal.remove(myBinding.getListener());
         * @return {Function|null} Handler function bound to the signal or `null` if binding was previously detached.
         */
        detach : function () {
            return this.isBound()? this._signal.remove(this._listener, this.context) : null;
        },

        /**
         * @return {Boolean} `true` if binding is still bound to the signal and have a listener.
         */
        isBound : function () {
            return (!!this._signal && !!this._listener);
        },

        /**
         * @return {boolean} If SignalBinding will only be executed once.
         */
        isOnce : function () {
            return this._isOnce;
        },

        /**
         * @return {Function} Handler function bound to the signal.
         */
        getListener : function () {
            return this._listener;
        },

        /**
         * @return {Signal} Signal that listener is currently bound to.
         */
        getSignal : function () {
            return this._signal;
        },

        /**
         * Delete instance properties
         * @private
         */
        _destroy : function () {
            delete this._signal;
            delete this._listener;
            delete this.context;
        },

        /**
         * @return {string} String representation of the object.
         */
        toString : function () {
            return '[SignalBinding isOnce:' + this._isOnce +', isBound:'+ this.isBound() +', active:' + this.active + ']';
        }

    };


/*global SignalBinding:false*/

    // Signal --------------------------------------------------------
    //================================================================

    function validateListener(listener, fnName) {
        if (typeof listener !== 'function') {
            throw new Error( 'listener is a required param of {fn}() and should be a Function.'.replace('{fn}', fnName) );
        }
    }

    /**
     * Custom event broadcaster
     * <br />- inspired by Robert Penner's AS3 Signals.
     * @name Signal
     * @author Miller Medeiros
     * @constructor
     */
    function Signal() {
        /**
         * @type Array.<SignalBinding>
         * @private
         */
        this._bindings = [];
        this._prevParams = null;

        // enforce dispatch to aways work on same context (#47)
        var self = this;
        this.dispatch = function(){
            Signal.prototype.dispatch.apply(self, arguments);
        };
    }

    Signal.prototype = {

        /**
         * Signals Version Number
         * @type String
         * @const
         */
        VERSION : '1.0.0',

        /**
         * If Signal should keep record of previously dispatched parameters and
         * automatically execute listener during `add()`/`addOnce()` if Signal was
         * already dispatched before.
         * @type boolean
         */
        memorize : false,

        /**
         * @type boolean
         * @private
         */
        _shouldPropagate : true,

        /**
         * If Signal is active and should broadcast events.
         * <p><strong>IMPORTANT:</strong> Setting this property during a dispatch will only affect the next dispatch, if you want to stop the propagation of a signal use `halt()` instead.</p>
         * @type boolean
         */
        active : true,

        /**
         * @param {Function} listener
         * @param {boolean} isOnce
         * @param {Object} [listenerContext]
         * @param {Number} [priority]
         * @return {SignalBinding}
         * @private
         */
        _registerListener : function (listener, isOnce, listenerContext, priority) {

            var prevIndex = this._indexOfListener(listener, listenerContext),
                binding;

            if (prevIndex !== -1) {
                binding = this._bindings[prevIndex];
                if (binding.isOnce() !== isOnce) {
                    throw new Error('You cannot add'+ (isOnce? '' : 'Once') +'() then add'+ (!isOnce? '' : 'Once') +'() the same listener without removing the relationship first.');
                }
            } else {
                binding = new SignalBinding(this, listener, isOnce, listenerContext, priority);
                this._addBinding(binding);
            }

            if(this.memorize && this._prevParams){
                binding.execute(this._prevParams);
            }

            return binding;
        },

        /**
         * @param {SignalBinding} binding
         * @private
         */
        _addBinding : function (binding) {
            //simplified insertion sort
            var n = this._bindings.length;
            do { --n; } while (this._bindings[n] && binding._priority <= this._bindings[n]._priority);
            this._bindings.splice(n + 1, 0, binding);
        },

        /**
         * @param {Function} listener
         * @return {number}
         * @private
         */
        _indexOfListener : function (listener, context) {
            var n = this._bindings.length,
                cur;
            while (n--) {
                cur = this._bindings[n];
                if (cur._listener === listener && cur.context === context) {
                    return n;
                }
            }
            return -1;
        },

        /**
         * Check if listener was attached to Signal.
         * @param {Function} listener
         * @param {Object} [context]
         * @return {boolean} if Signal has the specified listener.
         */
        has : function (listener, context) {
            return this._indexOfListener(listener, context) !== -1;
        },

        /**
         * Add a listener to the signal.
         * @param {Function} listener Signal handler function.
         * @param {Object} [listenerContext] Context on which listener will be executed (object that should represent the `this` variable inside listener function).
         * @param {Number} [priority] The priority level of the event listener. Listeners with higher priority will be executed before listeners with lower priority. Listeners with same priority level will be executed at the same order as they were added. (default = 0)
         * @return {SignalBinding} An Object representing the binding between the Signal and listener.
         */
        add : function (listener, listenerContext, priority) {
            validateListener(listener, 'add');
            return this._registerListener(listener, false, listenerContext, priority);
        },

        /**
         * Add listener to the signal that should be removed after first execution (will be executed only once).
         * @param {Function} listener Signal handler function.
         * @param {Object} [listenerContext] Context on which listener will be executed (object that should represent the `this` variable inside listener function).
         * @param {Number} [priority] The priority level of the event listener. Listeners with higher priority will be executed before listeners with lower priority. Listeners with same priority level will be executed at the same order as they were added. (default = 0)
         * @return {SignalBinding} An Object representing the binding between the Signal and listener.
         */
        addOnce : function (listener, listenerContext, priority) {
            validateListener(listener, 'addOnce');
            return this._registerListener(listener, true, listenerContext, priority);
        },

        /**
         * Remove a single listener from the dispatch queue.
         * @param {Function} listener Handler function that should be removed.
         * @param {Object} [context] Execution context (since you can add the same handler multiple times if executing in a different context).
         * @return {Function} Listener handler function.
         */
        remove : function (listener, context) {
            validateListener(listener, 'remove');

            var i = this._indexOfListener(listener, context);
            if (i !== -1) {
                this._bindings[i]._destroy(); //no reason to a SignalBinding exist if it isn't attached to a signal
                this._bindings.splice(i, 1);
            }
            return listener;
        },

        /**
         * Remove all listeners from the Signal.
         */
        removeAll : function () {
            var n = this._bindings.length;
            while (n--) {
                this._bindings[n]._destroy();
            }
            this._bindings.length = 0;
        },

        /**
         * @return {number} Number of listeners attached to the Signal.
         */
        getNumListeners : function () {
            return this._bindings.length;
        },

        /**
         * Stop propagation of the event, blocking the dispatch to next listeners on the queue.
         * <p><strong>IMPORTANT:</strong> should be called only during signal dispatch, calling it before/after dispatch won't affect signal broadcast.</p>
         * @see Signal.prototype.disable
         */
        halt : function () {
            this._shouldPropagate = false;
        },

        /**
         * Dispatch/Broadcast Signal to all listeners added to the queue.
         * @param {...*} [params] Parameters that should be passed to each handler.
         */
        dispatch : function (params) {
            if (! this.active) {
                return;
            }

            var paramsArr = Array.prototype.slice.call(arguments),
                n = this._bindings.length,
                bindings;

            if (this.memorize) {
                this._prevParams = paramsArr;
            }

            if (! n) {
                //should come after memorize
                return;
            }

            bindings = this._bindings.slice(); //clone array in case add/remove items during dispatch
            this._shouldPropagate = true; //in case `halt` was called before dispatch or during the previous dispatch.

            //execute all callbacks until end of the list or until a callback returns `false` or stops propagation
            //reverse loop since listeners with higher priority will be added at the end of the list
            do { n--; } while (bindings[n] && this._shouldPropagate && bindings[n].execute(paramsArr) !== false);
        },

        /**
         * Forget memorized arguments.
         * @see Signal.memorize
         */
        forget : function(){
            this._prevParams = null;
        },

        /**
         * Remove all bindings from signal and destroy any reference to external objects (destroy Signal object).
         * <p><strong>IMPORTANT:</strong> calling any method on the signal instance after calling dispose will throw errors.</p>
         */
        dispose : function () {
            this.removeAll();
            delete this._bindings;
            delete this._prevParams;
        },

        /**
         * @return {string} String representation of the object.
         */
        toString : function () {
            return '[Signal active:'+ this.active +' numListeners:'+ this.getNumListeners() +']';
        }

    };


    // Namespace -----------------------------------------------------
    //================================================================

    /**
     * Signals namespace
     * @namespace
     * @name signals
     */
    var signals = Signal;

    /**
     * Custom event broadcaster
     * @see Signal
     */
    // alias for backwards compatibility (see #gh-44)
    signals.Signal = Signal;



    //exports to multiple environments
    if(typeof define === 'function' && define.amd){ //AMD
        define(function () { return signals; });
    } else if (typeof module !== 'undefined' && module.exports){ //node
        module.exports = signals;
    } else { //browser
        //use string because of Google closure compiler ADVANCED_MODE
        /*jslint sub:true */
        global['signals'] = signals;
    }

}(this));

},{}],6:[function(require,module,exports){
/**
 * The core kami module provides basic 2D sprite batching and 
 * asset management.
 * 
 * @module kami
 */

var Class = require('klasse');
var Mesh = require('./glutils/Mesh');

var colorToFloat = require('number-util').colorToFloat;

/** 
 * A batcher mixin composed of quads (two tris, indexed). 
 *
 * This is used internally; users should look at 
 * {{#crossLink "SpriteBatch"}}{{/crossLink}} instead, which inherits from this
 * class.
 * 
 * The batcher itself is not managed by WebGLContext; however, it makes
 * use of Mesh and Texture which will be managed. For this reason, the batcher
 * does not hold a direct reference to the GL state.
 *
 * Subclasses must implement the following:  
 * {{#crossLink "BaseBatch/_createShader:method"}}{{/crossLink}}  
 * {{#crossLink "BaseBatch/_createVertexAttributes:method"}}{{/crossLink}}  
 * {{#crossLink "BaseBatch/getVertexSize:method"}}{{/crossLink}}  
 * 
 * @class  BaseBatch
 * @constructor
 * @param {WebGLContext} context the context this batcher belongs to
 * @param {Number} size the optional size of this batch, i.e. max number of quads
 * @default  500
 */
var BaseBatch = new Class({

	//Constructor
	initialize: function BaseBatch(context, size) {
		if (typeof context !== "object")
			throw "GL context not specified to SpriteBatch";
		this.context = context;

		this.size = size || 500;
		
		// 65535 is max index, so 65535 / 6 = 10922.
		if (this.size > 10922)  //(you'd have to be insane to try and batch this much with WebGL)
			throw "Can't have more than 10922 sprites per batch: " + this.size;
				
		
		
		this._blendSrc = this.context.gl.ONE;
		this._blendDst = this.context.gl.ONE_MINUS_SRC_ALPHA
		this._blendingEnabled = true;
		this._shader = this._createShader();

		/**
		 * This shader will be used whenever "null" is passed
		 * as the batch's shader. 
		 *
		 * @property {ShaderProgram} shader
		 */
		this.defaultShader = this._shader;

		/**
		 * By default, a SpriteBatch is created with its own ShaderProgram,
		 * stored in `defaultShader`. If this flag is true, on deleting the SpriteBatch, its
		 * `defaultShader` will also be deleted. If this flag is false, no shaders
		 * will be deleted on destroy.
		 *
		 * Note that if you re-assign `defaultShader`, you will need to dispose the previous
		 * default shader yoursel. 
		 *
		 * @property ownsShader
		 * @type {Boolean}
		 */
		this.ownsShader = true;

		this.idx = 0;

		/**
		 * Whether we are currently drawing to the batch. Do not modify.
		 * 
		 * @property {Boolean} drawing
		 */
		this.drawing = false;

		this.mesh = this._createMesh(this.size);


		/**
		 * The ABGR packed color, as a single float. The default
		 * value is the color white (255, 255, 255, 255).
		 *
		 * @property {Number} color
		 * @readOnly 
		 */
		this.color = colorToFloat(255, 255, 255, 255);
		
		/**
		 * Whether to premultiply alpha on calls to setColor. 
		 * This is true by default, so that we can conveniently write:
		 *
		 *     batch.setColor(1, 0, 0, 0.25); //tints red with 25% opacity
		 *
		 * If false, you must premultiply the colors yourself to achieve
		 * the same tint, like so:
		 *
		 *     batch.setColor(0.25, 0, 0, 0.25);
		 * 
		 * @property premultiplied
		 * @type {Boolean}
		 * @default  true
		 */
		this.premultiplied = true;
	},

	/**
	 * A property to enable or disable blending for this sprite batch. If
	 * we are currently drawing, this will first flush the batch, and then
	 * update GL_BLEND state (enabled or disabled) with our new value.
	 * 
	 * @property {Boolean} blendingEnabled
	 */
	blendingEnabled: {
		set: function(val) {
			var old = this._blendingEnabled;
			if (this.drawing)
				this.flush();

			this._blendingEnabled = val;

			//if we have a new value, update it.
			//this is because blend is done in begin() / end() 
			if (this.drawing && old != val) {
				var gl = this.context.gl;
				if (val)
					gl.enable(gl.BLEND);
				else
					gl.disable(gl.BLEND);
			}

		},

		get: function() {
			return this._blendingEnabled;
		}
	},

	/**
	 * Sets the blend source parameters. 
	 * If we are currently drawing, this will flush the batch.
	 *
	 * Setting either src or dst to `null` or a falsy value tells the SpriteBatch
	 * to ignore gl.blendFunc. This is useful if you wish to use your
	 * own blendFunc or blendFuncSeparate. 
	 * 
	 * @property {GLenum} blendDst 
	 */
	blendSrc: {
		set: function(val) {
			if (this.drawing)
				this.flush();
			this._blendSrc = val;
		},

		get: function() {
			return this._blendSrc;
		}
	},

	/**
	 * Sets the blend destination parameters. 
	 * If we are currently drawing, this will flush the batch.
	 *
	 * Setting either src or dst to `null` or a falsy value tells the SpriteBatch
	 * to ignore gl.blendFunc. This is useful if you wish to use your
	 * own blendFunc or blendFuncSeparate. 
	 *
	 * @property {GLenum} blendSrc 
	 */
	blendDst: {
		set: function(val) {
			if (this.drawing)
				this.flush();
			this._blendDst = val;
		},

		get: function() {
			return this._blendDst;
		}
	},

	/**
	 * Sets the blend source and destination parameters. This is 
	 * a convenience function for the blendSrc and blendDst setters.
	 * If we are currently drawing, this will flush the batch.
	 *
	 * Setting either to `null` or a falsy value tells the SpriteBatch
	 * to ignore gl.blendFunc. This is useful if you wish to use your
	 * own blendFunc or blendFuncSeparate. 
	 *
	 * @method  setBlendFunction
	 * @param {GLenum} blendSrc the source blend parameter
	 * @param {GLenum} blendDst the destination blend parameter
	 */
	setBlendFunction: function(blendSrc, blendDst) {
		this.blendSrc = blendSrc;
		this.blendDst = blendDst;
	},

	/**
	 * This is a setter/getter for this batch's current ShaderProgram.
	 * If this is set when the batch is drawing, the state will be flushed
	 * to the GPU and the new shader will then be bound.
	 *
	 * If `null` or a falsy value is specified, the batch's `defaultShader` will be used. 
	 *
	 * Note that shaders are bound on batch.begin().
	 *
	 * @property shader
	 * @type {ShaderProgram}
	 */
	shader: {
		set: function(val) {
			var wasDrawing = this.drawing;

			if (wasDrawing) {
				this.end(); //unbinds the shader from the mesh
			}

			this._shader = val ? val : this.defaultShader;

			if (wasDrawing) {
				this.begin();
			}
		},

		get: function() {
			return this._shader;
		}
	},

	/**
	 * Sets the color of this sprite batcher, which is used in subsequent draw
	 * calls. This does not flush the batch.
	 *
	 * If r, g, b, are all numbers, this method assumes that RGB 
	 * or RGBA float values (0.0 to 1.0) are being passed. Alpha defaults to one
	 * if undefined.
	 * 
	 * If the first three arguments are not numbers, we only consider the first argument
	 * and assign it to all four components -- this is useful for setting transparency 
	 * in a premultiplied alpha stage. 
	 * 
	 * If the first argument is invalid or not a number,
	 * the color defaults to (1, 1, 1, 1).
	 *
	 * @method  setColor
	 * @param {Number} r the red component, normalized
	 * @param {Number} g the green component, normalized
	 * @param {Number} b the blue component, normalized
	 * @param {Number} a the alpha component, normalized
	 */
	setColor: function(r, g, b, a) {
		var rnum = typeof r === "number";
		if (rnum
				&& typeof g === "number"
				&& typeof b === "number") {
			//default alpha to one 
			a = (a || a === 0) ? a : 1.0;
		} else {
			r = g = b = a = rnum ? r : 1.0;
		}
		
		if (this.premultiplied) {
			r *= a;
			g *= a;
			b *= a;
		}
		
		this.color = colorToFloat(
			~~(r * 255),
			~~(g * 255),
			~~(b * 255),
			~~(a * 255)
		);
	},

	/**
	 * Called from the constructor to create a new Mesh 
	 * based on the expected batch size. Should set up
	 * verts & indices properly.
	 *
	 * Users should not call this directly; instead, it
	 * should only be implemented by subclasses.
	 * 
	 * @method _createMesh
	 * @param {Number} size the size passed through the constructor
	 */
	_createMesh: function(size) {
		//the total number of floats in our batch
		var numVerts = size * 4 * this.getVertexSize();
		//the total number of indices in our batch
		var numIndices = size * 6;
		var gl = this.context.gl;

		//vertex data
		this.vertices = new Float32Array(numVerts);
		//index data
		this.indices = new Uint16Array(numIndices); 
		
		for (var i=0, j=0; i < numIndices; i += 6, j += 4) 
		{
			this.indices[i + 0] = j + 0; 
			this.indices[i + 1] = j + 1;
			this.indices[i + 2] = j + 2;
			this.indices[i + 3] = j + 0;
			this.indices[i + 4] = j + 2;
			this.indices[i + 5] = j + 3;
		}

		var mesh = new Mesh(this.context, false, 
						numVerts, numIndices, this._createVertexAttributes());
		mesh.vertices = this.vertices;
		mesh.indices = this.indices;
		mesh.vertexUsage = gl.DYNAMIC_DRAW;
		mesh.indexUsage = gl.STATIC_DRAW;
		mesh.dirty = true;
		return mesh;
	},

	/**
	 * Returns a shader for this batch. If you plan to support
	 * multiple instances of your batch, it may or may not be wise
	 * to use a shared shader to save resources.
	 * 
	 * This method initially throws an error; so it must be overridden by
	 * subclasses of BaseBatch.
	 *
	 * @method  _createShader
	 * @return {Number} the size of a vertex, in # of floats
	 */
	_createShader: function() {
		throw "_createShader not implemented"
	},	

	/**
	 * Returns an array of vertex attributes for this mesh; 
	 * subclasses should implement this with the attributes 
	 * expected for their batch.
	 *
	 * This method initially throws an error; so it must be overridden by
	 * subclasses of BaseBatch.
	 *
	 * @method _createVertexAttributes
	 * @return {Array} an array of Mesh.VertexAttrib objects
	 */
	_createVertexAttributes: function() {
		throw "_createVertexAttributes not implemented";
	},


	/**
	 * Returns the number of floats per vertex for this batcher.
	 * 
	 * This method initially throws an error; so it must be overridden by
	 * subclasses of BaseBatch.
	 *
	 * @method  getVertexSize
	 * @return {Number} the size of a vertex, in # of floats
	 */
	getVertexSize: function() {
		throw "getVertexSize not implemented";
	},

	
	/** 
	 * Begins the sprite batch. This will bind the shader
	 * and mesh. Subclasses may want to disable depth or 
	 * set up blending.
	 *
	 * @method  begin
	 */
	begin: function()  {
		if (this.drawing) 
			throw "batch.end() must be called before begin";
		this.drawing = true;

		this.shader.bind();

		//bind the attributes now to avoid redundant calls
		this.mesh.bind(this.shader);

		if (this._blendingEnabled) {
			var gl = this.context.gl;
			gl.enable(gl.BLEND);
		}
	},

	/** 
	 * Ends the sprite batch. This will flush any remaining 
	 * data and set GL state back to normal.
	 * 
	 * @method  end
	 */
	end: function()  {
		if (!this.drawing)
			throw "batch.begin() must be called before end";
		if (this.idx > 0)
			this.flush();
		this.drawing = false;

		this.mesh.unbind(this.shader);

		if (this._blendingEnabled) {
			var gl = this.context.gl;
			gl.disable(gl.BLEND);
		}
	},

	/** 
	 * Called before rendering to bind new textures.
	 * This method does nothing by default.
	 *
	 * @method  _preRender
	 */
	_preRender: function()  {
	},

	/**
	 * Flushes the batch by pushing the current data
	 * to GL.
	 * 
	 * @method flush
	 */
	flush: function()  {
		if (this.idx===0)
			return;

		var gl = this.context.gl;

		//premultiplied alpha
		if (this._blendingEnabled) {
			//set either to null if you want to call your own 
			//blendFunc or blendFuncSeparate
			if (this._blendSrc && this._blendDst)
				gl.blendFunc(this._blendSrc, this._blendDst); 
		}

		this._preRender();

		//number of sprites in batch
		var numComponents = this.getVertexSize();
		var spriteCount = (this.idx / (numComponents * 4));
		
		//draw the sprites
		this.mesh.verticesDirty = true;
		this.mesh.draw(gl.TRIANGLES, spriteCount * 6, 0, this.idx);

		this.idx = 0;
	},

	/**
	 * Adds a sprite to this batch.
	 * The specifics depend on the sprite batch implementation.
	 *
	 * @method draw
	 * @param  {Texture} texture the texture for this sprite
	 * @param  {Number} x       the x position, defaults to zero
	 * @param  {Number} y       the y position, defaults to zero
	 * @param  {Number} width   the width, defaults to the texture width
	 * @param  {Number} height  the height, defaults to the texture height
	 * @param  {Number} u1      the first U coordinate, default zero
	 * @param  {Number} v1      the first V coordinate, default zero
	 * @param  {Number} u2      the second U coordinate, default one
	 * @param  {Number} v2      the second V coordinate, default one
	 */
	draw: function(texture, x, y, width, height, u1, v1, u2, v2) {
	},

	/**
	 * Adds a single quad mesh to this sprite batch from the given
	 * array of vertices.
	 * The specifics depend on the sprite batch implementation.
	 *
	 * @method  drawVertices
	 * @param {Texture} texture the texture we are drawing for this sprite
	 * @param {Float32Array} verts an array of vertices
	 * @param {Number} off the offset into the vertices array to read from
	 */
	drawVertices: function(texture, verts, off)  {
	},

	drawRegion: function(region, x, y, width, height) {
		this.draw(region.texture, x, y, width, height, region.u, region.v, region.u2, region.v2);
	},

	/**
	 * Destroys the batch, deleting its buffers and removing it from the
	 * WebGLContext management. Trying to use this
	 * batch after destroying it can lead to unpredictable behaviour.
	 *
	 * If `ownsShader` is true, this will also delete the `defaultShader` object.
	 * 
	 * @method destroy
	 */
	destroy: function() {
		this.vertices = null;
		this.indices = null;
		this.size = this.maxVertices = 0;

		if (this.ownsShader && this.defaultShader)
			this.defaultShader.destroy();
		this.defaultShader = null;
		this._shader = null; // remove reference to whatever shader is currently being used

		if (this.mesh) 
			this.mesh.destroy();
		this.mesh = null;
	}
});

module.exports = BaseBatch;

},{"./glutils/Mesh":12,"klasse":17,"number-util":15}],7:[function(require,module,exports){
/**
 * @module kami
 */

// Requires....
var Class         = require('klasse');

var BaseBatch = require('./BaseBatch');

var Mesh          = require('./glutils/Mesh');
var ShaderProgram = require('./glutils/ShaderProgram');

/**
 * A basic implementation of a batcher which draws 2D sprites.
 * This uses two triangles (quads) with indexed and interleaved
 * vertex data. Each vertex holds 5 floats (Position.xy, Color, TexCoord0.xy).
 *
 * The color is packed into a single float to reduce vertex bandwidth, and
 * the data is interleaved for best performance. We use a static index buffer,
 * and a dynamic vertex buffer that is updated with bufferSubData. 
 * 
 * @example
 *      var SpriteBatch = require('kami').SpriteBatch;  
 *      
 *      //create a new batcher
 *      var batch = new SpriteBatch(context);
 *
 *      function render() {
 *          batch.begin();
 *          
 *          //draw some sprites in between begin and end...
 *          batch.draw( texture, 0, 0, 25, 32 );
 *          batch.draw( texture1, 0, 25, 42, 23 );
 * 
 *          batch.end();
 *      }
 * 
 * @class  SpriteBatch
 * @uses BaseBatch
 * @constructor
 * @param {WebGLContext} context the context for this batch
 * @param {Number} size the max number of sprites to fit in a single batch
 */
var SpriteBatch = new Class({

	//inherit some stuff onto this prototype
	Mixins: BaseBatch,

	//Constructor
	initialize: function SpriteBatch(context, size) {
		BaseBatch.call(this, context, size);

		/**
		 * The projection Float32Array vec2 which is
		 * used to avoid some matrix calculations.
		 *
		 * @property projection
		 * @type {Float32Array}
		 */
		this.projection = new Float32Array(2);

		//Sets up a default projection vector so that the batch works without setProjection
		this.projection[0] = this.context.width/2;
		this.projection[1] = this.context.height/2;

		/**
		 * The currently bound texture. Do not modify.
		 * 
		 * @property {Texture} texture
		 * @readOnly
		 */
		this.texture = null;
	},

	/**
	 * This is a convenience function to set the batch's projection
	 * matrix to an orthographic 2D projection, based on the given screen
	 * size. This allows users to render in 2D without any need for a camera.
	 * 
	 * @param  {[type]} width  [description]
	 * @param  {[type]} height [description]
	 * @return {[type]}        [description]
	 */
	resize: function(width, height) {
		this.setProjection(width/2, height/2);
	},

	/**
	 * The number of floats per vertex for this batcher 
	 * (Position.xy + Color + TexCoord0.xy).
	 *
	 * @method  getVertexSize
	 * @return {Number} the number of floats per vertex
	 */
	getVertexSize: function() {
		return SpriteBatch.VERTEX_SIZE;
	},

	/**
	 * Used internally to return the Position, Color, and TexCoord0 attributes.
	 *
	 * @method  _createVertexAttribuets
	 * @protected
	 * @return {[type]} [description]
	 */
	_createVertexAttributes: function() {
		var gl = this.context.gl;

		return [ 
			new Mesh.Attrib(ShaderProgram.POSITION_ATTRIBUTE, 2),
			 //pack the color using some crazy wizardry 
			new Mesh.Attrib(ShaderProgram.COLOR_ATTRIBUTE, 4, null, gl.UNSIGNED_BYTE, true, 1),
			new Mesh.Attrib(ShaderProgram.TEXCOORD_ATTRIBUTE+"0", 2)
		];
	},


	/**
	 * Sets the projection vector, an x and y
	 * defining the middle points of your stage.
	 *
	 * @method setProjection
	 * @param {Number} x the x projection value
	 * @param {Number} y the y projection value
	 */
	setProjection: function(x, y) {
		var oldX = this.projection[0];
		var oldY = this.projection[1];
		this.projection[0] = x;
		this.projection[1] = y;

		//we need to flush the batch..
		if (this.drawing && (x != oldX || y != oldY)) {
			this.flush();
			this._updateMatrices();
		}
	},

	/**
	 * Creates a default shader for this batch.
	 *
	 * @method  _createShader
	 * @protected
	 * @return {ShaderProgram} a new instance of ShaderProgram
	 */
	_createShader: function() {
		var shader = new ShaderProgram(this.context,
				SpriteBatch.DEFAULT_VERT_SHADER, 
				SpriteBatch.DEFAULT_FRAG_SHADER);
		if (shader.log)
			console.warn("Shader Log:\n" + shader.log);
		return shader;
	},

	/**
	 * This is called during rendering to update projection/transform
	 * matrices and upload the new values to the shader. For example,
	 * if the user calls setProjection mid-draw, the batch will flush
	 * and this will be called before continuing to add items to the batch.
	 *
	 * You generally should not need to call this directly.
	 * 
	 * @method  updateMatrices
	 * @protected
	 */
	updateMatrices: function() {
		this.shader.setUniformfv("u_projection", this.projection);
	},

	/**
	 * Called before rendering, and binds the current texture.
	 * 
	 * @method _preRender
	 * @protected
	 */
	_preRender: function() {
		if (this.texture)
			this.texture.bind();
	},

	/**
	 * Binds the shader, disables depth writing, 
	 * enables blending, activates texture unit 0, and sends
	 * default matrices and sampler2D uniforms to the shader.
	 *
	 * @method  begin
	 */
	begin: function() {
		//sprite batch doesn't hold a reference to GL since it is volatile
		var gl = this.context.gl;
		
		//This binds the shader and mesh!
		BaseBatch.prototype.begin.call(this);

		this.updateMatrices(); //send projection/transform to shader

		//upload the sampler uniform. not necessary every flush so we just
		//do it here.
		this.shader.setUniformi("u_texture0", 0);

		//disable depth mask
		gl.depthMask(false);
	},

	/**
	 * Ends the sprite batcher and flushes any remaining data to the GPU.
	 * 
	 * @method end
	 */
	end: function() {
		//sprite batch doesn't hold a reference to GL since it is volatile
		var gl = this.context.gl;
		
		//just do direct parent call for speed here
		//This binds the shader and mesh!
		BaseBatch.prototype.end.call(this);

		gl.depthMask(true);
	},

	/**
	 * Flushes the batch to the GPU. This should be called when
	 * state changes, such as blend functions, depth or stencil states,
	 * shaders, and so forth.
	 * 
	 * @method flush
	 */
	flush: function() {
		//ignore flush if texture is null or our batch is empty
		if (!this.texture)
			return;
		if (this.idx === 0)
			return;
		BaseBatch.prototype.flush.call(this);
		SpriteBatch.totalRenderCalls++;
	},

	/**
	 * Adds a sprite to this batch. The sprite is drawn in 
	 * screen-space with the origin at the upper-left corner (y-down).
	 * 
	 * @method draw
	 * @param  {Texture} texture the Texture
	 * @param  {Number} x       the x position in pixels, defaults to zero
	 * @param  {Number} y       the y position in pixels, defaults to zero
	 * @param  {Number} width   the width in pixels, defaults to the texture width
	 * @param  {Number} height  the height in pixels, defaults to the texture height
	 * @param  {Number} u1      the first U coordinate, default zero
	 * @param  {Number} v1      the first V coordinate, default zero
	 * @param  {Number} u2      the second U coordinate, default one
	 * @param  {Number} v2      the second V coordinate, default one
	 */
	draw: function(texture, x, y, width, height, u1, v1, u2, v2) {
		if (!this.drawing)
			throw "Illegal State: trying to draw a batch before begin()";

		//don't draw anything if GL tex doesn't exist..
		if (!texture)
			return;

		if (this.texture === null || this.texture.id !== texture.id) {
			//new texture.. flush previous data
			this.flush();
			this.texture = texture;
		} else if (this.idx == this.vertices.length) {
			this.flush(); //we've reached our max, flush before pushing more data
		}

		width = (width===0) ? width : (width || texture.width);
		height = (height===0) ? height : (height || texture.height);
		x = x || 0;
		y = y || 0;

		var x1 = x;
		var x2 = x + width;
		var y1 = y;
		var y2 = y + height;

		u1 = u1 || 0;
		u2 = (u2===0) ? u2 : (u2 || 1);
		v1 = v1 || 0;
		v2 = (v2===0) ? v2 : (v2 || 1);

		var c = this.color;

		//xy
		this.vertices[this.idx++] = x1;
		this.vertices[this.idx++] = y1;
		//color
		this.vertices[this.idx++] = c;
		//uv
		this.vertices[this.idx++] = u1;
		this.vertices[this.idx++] = v1;
		
		//xy
		this.vertices[this.idx++] = x2;
		this.vertices[this.idx++] = y1;
		//color
		this.vertices[this.idx++] = c;
		//uv
		this.vertices[this.idx++] = u2;
		this.vertices[this.idx++] = v1;

		//xy
		this.vertices[this.idx++] = x2;
		this.vertices[this.idx++] = y2;
		//color
		this.vertices[this.idx++] = c;
		//uv
		this.vertices[this.idx++] = u2;
		this.vertices[this.idx++] = v2;

		//xy
		this.vertices[this.idx++] = x1;
		this.vertices[this.idx++] = y2;
		//color
		this.vertices[this.idx++] = c;
		//uv
		this.vertices[this.idx++] = u1;
		this.vertices[this.idx++] = v2;
	},

	/**
	 * Adds a single quad mesh to this sprite batch from the given
	 * array of vertices. The sprite is drawn in 
	 * screen-space with the origin at the upper-left corner (y-down).
	 *
	 * This reads 20 interleaved floats from the given offset index, in the format
	 *
	 *  { x, y, color, u, v,
	 *      ...  }
	 *
	 * @method  drawVertices
	 * @param {Texture} texture the Texture object
	 * @param {Float32Array} verts an array of vertices
	 * @param {Number} off the offset into the vertices array to read from
	 */
	drawVertices: function(texture, verts, off) {
		if (!this.drawing)
			throw "Illegal State: trying to draw a batch before begin()";
		
		//don't draw anything if GL tex doesn't exist..
		if (!texture)
			return;


		if (this.texture != texture) {
			//new texture.. flush previous data
			this.flush();
			this.texture = texture;
		} else if (this.idx == this.vertices.length) {
			this.flush(); //we've reached our max, flush before pushing more data
		}

		off = off || 0;
		//TODO: use a loop here?
		//xy
		this.vertices[this.idx++] = verts[off++];
		this.vertices[this.idx++] = verts[off++];
		//color
		this.vertices[this.idx++] = verts[off++];
		//uv
		this.vertices[this.idx++] = verts[off++];
		this.vertices[this.idx++] = verts[off++];
		
		//xy
		this.vertices[this.idx++] = verts[off++];
		this.vertices[this.idx++] = verts[off++];
		//color
		this.vertices[this.idx++] = verts[off++];
		//uv
		this.vertices[this.idx++] = verts[off++];
		this.vertices[this.idx++] = verts[off++];

		//xy
		this.vertices[this.idx++] = verts[off++];
		this.vertices[this.idx++] = verts[off++];
		//color
		this.vertices[this.idx++] = verts[off++];
		//uv
		this.vertices[this.idx++] = verts[off++];
		this.vertices[this.idx++] = verts[off++];

		//xy
		this.vertices[this.idx++] = verts[off++];
		this.vertices[this.idx++] = verts[off++];
		//color
		this.vertices[this.idx++] = verts[off++];
		//uv
		this.vertices[this.idx++] = verts[off++];
		this.vertices[this.idx++] = verts[off++];
	}
});

/**
 * The default vertex size, i.e. number of floats per vertex.
 * @attribute  VERTEX_SIZE
 * @static
 * @final
 * @type {Number}
 * @default  5
 */
SpriteBatch.VERTEX_SIZE = 5;

/**
 * Incremented after each draw call, can be used for debugging.
 *
 *     SpriteBatch.totalRenderCalls = 0;
 *
 *     ... draw your scene ...
 *
 *     console.log("Draw calls per frame:", SpriteBatch.totalRenderCalls);
 *
 * 
 * @attribute  totalRenderCalls
 * @static
 * @type {Number}
 * @default  0
 */
SpriteBatch.totalRenderCalls = 0;

SpriteBatch.DEFAULT_FRAG_SHADER = [
	"precision mediump float;",
	"varying vec2 vTexCoord0;",
	"varying vec4 vColor;",
	"uniform sampler2D u_texture0;",

	"void main(void) {",
	"   gl_FragColor = texture2D(u_texture0, vTexCoord0) * vColor;",
	"}"
].join('\n');

SpriteBatch.DEFAULT_VERT_SHADER = [
	"attribute vec2 "+ShaderProgram.POSITION_ATTRIBUTE+";",
	"attribute vec4 "+ShaderProgram.COLOR_ATTRIBUTE+";",
	"attribute vec2 "+ShaderProgram.TEXCOORD_ATTRIBUTE+"0;",

	"uniform vec2 u_projection;",
	"varying vec2 vTexCoord0;",
	"varying vec4 vColor;",

	"void main(void) {", ///TODO: use a projection and transform matrix
	"   gl_Position = vec4( "
		+ShaderProgram.POSITION_ATTRIBUTE
		+".x / u_projection.x - 1.0, "
		+ShaderProgram.POSITION_ATTRIBUTE
		+".y / -u_projection.y + 1.0 , 0.0, 1.0);",
	"   vTexCoord0 = "+ShaderProgram.TEXCOORD_ATTRIBUTE+"0;",
	"   vColor = "+ShaderProgram.COLOR_ATTRIBUTE+";",
	"}"
].join('\n');

module.exports = SpriteBatch;

},{"./BaseBatch":6,"./glutils/Mesh":12,"./glutils/ShaderProgram":13,"klasse":17}],8:[function(require,module,exports){
/**
 * @module kami
 */

var Class = require('klasse');
var Signal = require('signals');
var nextPowerOfTwo = require('number-util').nextPowerOfTwo;
var isPowerOfTwo = require('number-util').isPowerOfTwo;

var Texture = new Class({


	/**
	 * Creates a new texture with the optional width, height, and data.
	 *
	 * If the constructor is passed no parameters other than WebGLContext, then
	 * it will not be initialized and will be non-renderable. You will need to manually
	 * uploadData or uploadImage yourself.
	 *
	 * If you pass a width and height after context, the texture will be initialized with that size
	 * and null data (e.g. transparent black). If you also pass the format and data, 
	 * it will be uploaded to the texture. 
	 *
	 * If you pass a String or Data URI as the second parameter,
	 * this Texture will load an Image object asynchronously. The optional third
	 * and fourth parameters are callback functions for success and failure, respectively. 
	 * The optional fifrth parameter for this version of the constructor is genMipmaps, which defaults to false. 
	 * 
	 * The arguments are kept in memory for future context restoration events. If
	 * this is undesirable (e.g. huge buffers which need to be GC'd), you should not
	 * pass the data in the constructor, but instead upload it after creating an uninitialized 
	 * texture. You will need to manage it yourself, either by extending the create() method, 
	 * or listening to restored events in WebGLContext.
	 *
	 * Most users will want to use the AssetManager to create and manage their textures
	 * with asynchronous loading and context loss. 
	 *
	 * @example
	 * 		new Texture(context, 256, 256); //empty 256x256 texture
	 * 		new Texture(context, 1, 1, Texture.Format.RGBA, Texture.DataType.UNSIGNED_BYTE, 
	 * 					new Uint8Array([255,0,0,255])); //1x1 red texture
	 * 		new Texture(context, "test.png"); //loads image asynchronously
	 * 		new Texture(context, "test.png", successFunc, failFunc, useMipmaps); //extra params for image laoder 
	 *
	 * @class  Texture
	 * @constructor
	 * @param  {WebGLContext} context the WebGL context
	 * @param  {Number} width the width of this texture
	 * @param  {Number} height the height of this texture
	 * @param  {GLenum} format e.g. Texture.Format.RGBA
	 * @param  {GLenum} dataType e.g. Texture.DataType.UNSIGNED_BYTE (Uint8Array)
	 * @param  {GLenum} data the array buffer, e.g. a Uint8Array view
	 * @param  {Boolean} genMipmaps whether to generate mipmaps after uploading the data
	 */
	initialize: function Texture(context, width, height, format, dataType, data, genMipmaps) {
		if (typeof context !== "object")
			throw "GL context not specified to Texture";
		this.context = context;

		/**
		 * The WebGLTexture which backs this Texture object. This
		 * can be used for low-level GL calls.
		 * 
		 * @type {WebGLTexture}
		 */
		this.id = null; //initialized in create()

		/**
		 * The target for this texture unit, i.e. TEXTURE_2D. Subclasses
		 * should override the create() method to change this, for correct
		 * usage with context restore.
		 * 
		 * @property target
		 * @type {GLenum}
		 * @default  gl.TEXTURE_2D
		 */
		this.target = context.gl.TEXTURE_2D;

		/**
		 * The width of this texture, in pixels.
		 * 
		 * @property width
		 * @readOnly
		 * @type {Number} the width
		 */
		this.width = 0; //initialized on texture upload

		/**
		 * The height of this texture, in pixels.
		 * 
		 * @property height
		 * @readOnly
		 * @type {Number} the height
		 */
		this.height = 0; //initialized on texture upload

		// e.g. --> new Texture(gl, 256, 256, gl.RGB, gl.UNSIGNED_BYTE, data);
		//		      creates a new empty texture, 256x256
		//		--> new Texture(gl);
		//			  creates a new texture but WITHOUT uploading any data. 

		/**
		 * The S wrap parameter.
		 * @property {GLenum} wrapS
		 */
		this.wrapS = Texture.DEFAULT_WRAP;
		/**
		 * The T wrap parameter.
		 * @property {GLenum} wrapT
		 */
		this.wrapT = Texture.DEFAULT_WRAP;
		/**
		 * The minifcation filter.
		 * @property {GLenum} minFilter 
		 */
		this.minFilter = Texture.DEFAULT_FILTER;
		
		/**
		 * The magnification filter.
		 * @property {GLenum} magFilter 
		 */
		this.magFilter = Texture.DEFAULT_FILTER;

		/**
		 * When a texture is created, we keep track of the arguments provided to 
		 * its constructor. On context loss and restore, these arguments are re-supplied
		 * to the Texture, so as to re-create it in its correct form.
		 *
		 * This is mainly useful if you are procedurally creating textures and passing
		 * their data directly (e.g. for generic lookup tables in a shader). For image
		 * or media based textures, it would be better to use an AssetManager to manage
		 * the asynchronous texture upload.
		 *
		 * Upon destroying a texture, a reference to this is also lost.
		 *
		 * @property managedArgs
		 * @type {Array} the array of arguments, shifted to exclude the WebGLContext parameter
		 */
		this.managedArgs = Array.prototype.slice.call(arguments, 1);

		//This is maanged by WebGLContext
		this.context.addManagedObject(this);
		this.create();
	},

	/**
	 * This can be called after creating a Texture to load an Image object asynchronously,
	 * or upload image data directly. It takes the same parameters as the constructor, except 
	 * for the context which has already been established. 
	 *
	 * Users will generally not need to call this directly. 
	 * 
	 * @protected
	 * @method  setup
	 */
	setup: function(width, height, format, dataType, data, genMipmaps) {
		var gl = this.gl;

		//If the first argument is a string, assume it's an Image loader
		//second argument will then be genMipmaps, third and fourth the success/fail callbacks
		if (typeof width === "string") {
			var img = new Image();
			var path      = arguments[0];   //first argument, the path
			var successCB = typeof arguments[1] === "function" ? arguments[1] : null;
			var failCB    = typeof arguments[2] === "function" ? arguments[2] : null;
			genMipmaps    = !!arguments[3];

			var self = this;

			//If you try to render a texture that is not yet "renderable" (i.e. the 
			//async load hasn't completed yet, which is always the case in Chrome since requestAnimationFrame
			//fires before img.onload), WebGL will throw us errors. So instead we will just upload some
			//dummy data until the texture load is complete. Users can disable this with the global flag.
			if (Texture.USE_DUMMY_1x1_DATA) {
				self.uploadData(1, 1);
				this.width = this.height = 0;
			}

			img.onload = function() {
				self.uploadImage(img, undefined, undefined, genMipmaps);
				if (successCB)
					successCB();
			}
			img.onerror = function() {
				// console.warn("Error loading image: "+path);
				if (genMipmaps) //we still need to gen mipmaps on the 1x1 dummy
					gl.generateMipmap(gl.TEXTURE_2D);
				if (failCB)
					failCB();
			}
			img.onabort = function() {
				// console.warn("Image load aborted: "+path);
				if (genMipmaps) //we still need to gen mipmaps on the 1x1 dummy
					gl.generateMipmap(gl.TEXTURE_2D);
				if (failCB)
					failCB();
			}

			img.src = path;
		} 
		//otherwise assume our regular list of width/height arguments are passed
		else {
			this.uploadData(width, height, format, dataType, data, genMipmaps);
		}
	},	

	/**
	 * Called in the Texture constructor, and after the GL context has been re-initialized. 
	 * Subclasses can override this to provide a custom data upload, e.g. cubemaps or compressed
	 * textures.
	 *
	 * @method  create
	 */
	create: function() {
		this.gl = this.context.gl; 
		var gl = this.gl;

		this.id = gl.createTexture(); //texture ID is recreated
		this.width = this.height = 0; //size is reset to zero until loaded
		this.target = gl.TEXTURE_2D;  //the provider can change this if necessary (e.g. cube maps)

		this.bind();


		//TODO: clean these up a little. 
		gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, Texture.UNPACK_PREMULTIPLY_ALPHA);
		gl.pixelStorei(gl.UNPACK_ALIGNMENT, Texture.UNPACK_ALIGNMENT);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, Texture.UNPACK_FLIP_Y);
		
		var colorspace = Texture.UNPACK_COLORSPACE_CONVERSION || gl.BROWSER_DEFAULT_WEBGL;
		gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, colorspace);

		//setup wrap modes without binding redundantly
		this.setWrap(this.wrapS, this.wrapT, false);
		this.setFilter(this.minFilter, this.magFilter, false);
		
		if (this.managedArgs.length !== 0) {
			this.setup.apply(this, this.managedArgs);
		}
	},

	/**
	 * Destroys this texture by deleting the GL resource,
	 * removing it from the WebGLContext management stack,
	 * setting its size to zero, and id and managed arguments to null.
	 * 
	 * Trying to use this texture after may lead to undefined behaviour.
	 *
	 * @method  destroy
	 */
	destroy: function() {
		if (this.id && this.gl)
			this.gl.deleteTexture(this.id);
		if (this.context)
			this.context.removeManagedObject(this);
		this.width = this.height = 0;
		this.id = null;
		this.managedArgs = null;
		this.context = null;
		this.gl = null;
	},

	/**
	 * Sets the wrap mode for this texture; if the second argument
	 * is undefined or falsy, then both S and T wrap will use the first
	 * argument.
	 *
	 * You can use Texture.Wrap constants for convenience, to avoid needing 
	 * a GL reference.
	 *
	 * @method  setWrap
	 * @param {GLenum} s the S wrap mode
	 * @param {GLenum} t the T wrap mode
	 * @param {Boolean} ignoreBind (optional) if true, the bind will be ignored. 
	 */
	setWrap: function(s, t, ignoreBind) { //TODO: support R wrap mode
		if (s && t) {
			this.wrapS = s;
			this.wrapT = t;
		} else 
			this.wrapS = this.wrapT = s;
		
		//enforce POT rules..
		this._checkPOT();	

		if (!ignoreBind)
			this.bind();

		var gl = this.gl;
		gl.texParameteri(this.target, gl.TEXTURE_WRAP_S, this.wrapS);
		gl.texParameteri(this.target, gl.TEXTURE_WRAP_T, this.wrapT);
	},


	/**
	 * Sets the min and mag filter for this texture; 
	 * if mag is undefined or falsy, then both min and mag will use the
	 * filter specified for min.
	 *
	 * You can use Texture.Filter constants for convenience, to avoid needing 
	 * a GL reference.
	 *
	 * @method  setFilter
	 * @param {GLenum} min the minification filter
	 * @param {GLenum} mag the magnification filter
	 * @param {Boolean} ignoreBind if true, the bind will be ignored. 
	 */
	setFilter: function(min, mag, ignoreBind) { 
		if (min && mag) {
			this.minFilter = min;
			this.magFilter = mag;
		} else 
			this.minFilter = this.magFilter = min;
		
		//enforce POT rules..
		this._checkPOT();

		if (!ignoreBind)
			this.bind();

		var gl = this.gl;
		gl.texParameteri(this.target, gl.TEXTURE_MIN_FILTER, this.minFilter);
		gl.texParameteri(this.target, gl.TEXTURE_MAG_FILTER, this.magFilter);
	},

	/**
	 * A low-level method to upload the specified ArrayBufferView
	 * to this texture. This will cause the width and height of this
	 * texture to change.
	 *
	 * @method  uploadData
	 * @param  {Number} width          the new width of this texture,
	 *                                 defaults to the last used width (or zero)
	 * @param  {Number} height         the new height of this texture
	 *                                 defaults to the last used height (or zero)
	 * @param  {GLenum} format         the data format, default RGBA
	 * @param  {GLenum} type           the data type, default UNSIGNED_BYTE (Uint8Array)
	 * @param  {ArrayBufferView} data  the raw data for this texture, or null for an empty image
	 * @param  {Boolean} genMipmaps	   whether to generate mipmaps after uploading the data, default false
	 */
	uploadData: function(width, height, format, type, data, genMipmaps) {
		var gl = this.gl;

		format = format || gl.RGBA;
		type = type || gl.UNSIGNED_BYTE;
		data = data || null; //make sure falsey value is null for texImage2D

		this.width = (width || width==0) ? width : this.width;
		this.height = (height || height==0) ? height : this.height;

		this._checkPOT();

		this.bind();

		gl.texImage2D(this.target, 0, format, 
					  this.width, this.height, 0, format,
					  type, data);

		if (genMipmaps)
			gl.generateMipmap(this.target);
	},

	/**
	 * Uploads ImageData, HTMLImageElement, HTMLCanvasElement or 
	 * HTMLVideoElement.
	 *
	 * @method  uploadImage
	 * @param  {Object} domObject the DOM image container
	 * @param  {GLenum} format the format, default gl.RGBA
	 * @param  {GLenum} type the data type, default gl.UNSIGNED_BYTE
	 * @param  {Boolean} genMipmaps whether to generate mipmaps after uploading the data, default false
	 */
	uploadImage: function(domObject, format, type, genMipmaps) {
		var gl = this.gl;

		format = format || gl.RGBA;
		type = type || gl.UNSIGNED_BYTE;
		
		this.width = domObject.width;
		this.height = domObject.height;

		this._checkPOT();

		this.bind();

		gl.texImage2D(this.target, 0, format, format,
					  type, domObject);

		if (genMipmaps)
			gl.generateMipmap(this.target);
	},

	/**
	 * If FORCE_POT is false, we verify this texture to see if it is valid, 
	 * as per non-power-of-two rules. If it is non-power-of-two, it must have 
	 * a wrap mode of CLAMP_TO_EDGE, and the minification filter must be LINEAR
	 * or NEAREST. If we don't satisfy these needs, an error is thrown.
	 * 
	 * @method  _checkPOT
	 * @private
	 * @return {[type]} [description]
	 */
	_checkPOT: function() {
		if (!Texture.FORCE_POT) {
			//If minFilter is anything but LINEAR or NEAREST
			//or if wrapS or wrapT are not CLAMP_TO_EDGE...
			var wrongFilter = (this.minFilter !== Texture.Filter.LINEAR && this.minFilter !== Texture.Filter.NEAREST);
			var wrongWrap = (this.wrapS !== Texture.Wrap.CLAMP_TO_EDGE || this.wrapT !== Texture.Wrap.CLAMP_TO_EDGE);

			if ( wrongFilter || wrongWrap ) {
				if (!isPowerOfTwo(this.width) || !isPowerOfTwo(this.height))
					throw new Error(wrongFilter 
							? "Non-power-of-two textures cannot use mipmapping as filter"
							: "Non-power-of-two textures must use CLAMP_TO_EDGE as wrap");
			}
		}
	},

	/**
	 * Binds the texture. If unit is specified,
	 * it will bind the texture at the given slot
	 * (TEXTURE0, TEXTURE1, etc). If unit is not specified,
	 * it will simply bind the texture at whichever slot
	 * is currently active.
	 *
	 * @method  bind
	 * @param  {Number} unit the texture unit index, starting at 0
	 */
	bind: function(unit) {
		var gl = this.gl;
		if (unit || unit === 0)
			gl.activeTexture(gl.TEXTURE0 + unit);
		gl.bindTexture(this.target, this.id);
	},

	toString: function() {
		return this.id + ":" + this.width + "x" + this.height + "";
	}
});

/** 
 * A set of Filter constants that match their GL counterparts.
 * This is for convenience, to avoid the need for a GL rendering context.
 *
 * @example
 * ```
 *     Texture.Filter.NEAREST
 *     Texture.Filter.NEAREST_MIPMAP_LINEAR
 *     Texture.Filter.NEAREST_MIPMAP_NEAREST
 *     Texture.Filter.LINEAR
 *     Texture.Filter.LINEAR_MIPMAP_LINEAR
 *     Texture.Filter.LINEAR_MIPMAP_NEAREST
 * ```
 * @attribute Filter
 * @static
 * @type {Object}
 */
Texture.Filter = {
	NEAREST: 9728,
	NEAREST_MIPMAP_LINEAR: 9986,
	NEAREST_MIPMAP_NEAREST: 9984,
	LINEAR: 9729,
	LINEAR_MIPMAP_LINEAR: 9987,
	LINEAR_MIPMAP_NEAREST: 9985
};

/** 
 * A set of Wrap constants that match their GL counterparts.
 * This is for convenience, to avoid the need for a GL rendering context.
 *
 * @example
 * ```
 *     Texture.Wrap.CLAMP_TO_EDGE
 *     Texture.Wrap.MIRRORED_REPEAT
 *     Texture.Wrap.REPEAT
 * ```
 * @attribute Wrap
 * @static
 * @type {Object}
 */
Texture.Wrap = {
	CLAMP_TO_EDGE: 33071,
	MIRRORED_REPEAT: 33648,
	REPEAT: 10497
};

/** 
 * A set of Format constants that match their GL counterparts.
 * This is for convenience, to avoid the need for a GL rendering context.
 *
 * @example
 * ```
 *     Texture.Format.RGB
 *     Texture.Format.RGBA
 *     Texture.Format.LUMINANCE_ALPHA
 * ```
 * @attribute Format
 * @static
 * @type {Object}
 */
Texture.Format = {
	DEPTH_COMPONENT: 6402,
	ALPHA: 6406,
	RGBA: 6408,
	RGB: 6407,
	LUMINANCE: 6409,
	LUMINANCE_ALPHA: 6410
};

/** 
 * A set of DataType constants that match their GL counterparts.
 * This is for convenience, to avoid the need for a GL rendering context.
 *
 * @example
 * ```
 *     Texture.DataType.UNSIGNED_BYTE 
 *     Texture.DataType.FLOAT 
 * ```
 * @attribute DataType
 * @static
 * @type {Object}
 */
Texture.DataType = {
	BYTE: 5120,
	SHORT: 5122,
	INT: 5124,
	FLOAT: 5126,
	UNSIGNED_BYTE: 5121,
	UNSIGNED_INT: 5125,
	UNSIGNED_SHORT: 5123,
	UNSIGNED_SHORT_4_4_4_4: 32819,
	UNSIGNED_SHORT_5_5_5_1: 32820,
	UNSIGNED_SHORT_5_6_5: 33635
}

/**
 * The default wrap mode when creating new textures. If a custom 
 * provider was specified, it may choose to override this default mode.
 * 
 * @attribute {GLenum} DEFAULT_WRAP
 * @static 
 * @default  Texture.Wrap.CLAMP_TO_EDGE
 */
Texture.DEFAULT_WRAP = Texture.Wrap.CLAMP_TO_EDGE;


/**
 * The default filter mode when creating new textures. If a custom
 * provider was specified, it may choose to override this default mode.
 *
 * @attribute {GLenum} DEFAULT_FILTER
 * @static
 * @default  Texture.Filter.LINEAR
 */
Texture.DEFAULT_FILTER = Texture.Filter.NEAREST;

/**
 * By default, we do some error checking when creating textures
 * to ensure that they will be "renderable" by WebGL. Non-power-of-two
 * textures must use CLAMP_TO_EDGE as their wrap mode, and NEAREST or LINEAR
 * as their wrap mode. Further, trying to generate mipmaps for a NPOT image
 * will lead to errors. 
 *
 * However, you can disable this error checking by setting `FORCE_POT` to true.
 * This may be useful if you are running on specific hardware that supports POT 
 * textures, or in some future case where NPOT textures is added as a WebGL extension.
 * 
 * @attribute {Boolean} FORCE_POT
 * @static
 * @default  false
 */
Texture.FORCE_POT = false;

//default pixel store operations. Used in create()
Texture.UNPACK_FLIP_Y = false;
Texture.UNPACK_ALIGNMENT = 1;
Texture.UNPACK_PREMULTIPLY_ALPHA = true; 
Texture.UNPACK_COLORSPACE_CONVERSION = undefined;

//for the Image constructor we need to handle things a bit differently..
Texture.USE_DUMMY_1x1_DATA = true;

/**
 * Utility to get the number of components for the given GLenum, e.g. gl.RGBA returns 4.
 * Returns null if the specified format is not of type DEPTH_COMPONENT, ALPHA, LUMINANCE,
 * LUMINANCE_ALPHA, RGB, or RGBA.
 * 
 * @method getNumComponents
 * @static
 * @param  {GLenum} format a texture format, i.e. Texture.Format.RGBA
 * @return {Number} the number of components for this format
 */
Texture.getNumComponents = function(format) {
	switch (format) {
		case Texture.Format.DEPTH_COMPONENT:
		case Texture.Format.ALPHA:
		case Texture.Format.LUMINANCE:
			return 1;
		case Texture.Format.LUMINANCE_ALPHA:
			return 2;
		case Texture.Format.RGB:
			return 3;
		case Texture.Format.RGBA:
			return 4;
	}
	return null;
};

module.exports = Texture;
},{"klasse":17,"number-util":15,"signals":16}],9:[function(require,module,exports){
var Class = require('klasse');

//This is a GL-specific texture region, employing tangent space normalized coordinates U and V.
//A canvas-specific region would really just be a lightweight object with { x, y, width, height }
//in pixels.
var TextureRegion = new Class({

	initialize: function TextureRegion(texture, x, y, width, height) {
		this.texture = texture;
		this.setRegion(x, y, width, height);
	},

	setUVs: function(u, v, u2, v2) {
		this.regionWidth = Math.round(Math.abs(u2 - u) * this.texture.width);
        this.regionHeight = Math.round(Math.abs(v2 - v) * this.texture.height);

        // From LibGDX TextureRegion.java -- 
		// For a 1x1 region, adjust UVs toward pixel center to avoid filtering artifacts on AMD GPUs when drawing very stretched.
		if (this.regionWidth == 1 && this.regionHeight == 1) {
			var adjustX = 0.25 / this.texture.width;
			u += adjustX;
			u2 -= adjustX;
			var adjustY = 0.25 / this.texture.height;
			v += adjustY;
			v2 -= adjustY;
		}

		this.u = u;
		this.v = v;
		this.u2 = u2;
		this.v2 = v2;
	},

	setRegion: function(x, y, width, height) {
		x = x || 0;
		y = y || 0;
		width = (width===0 || width) ? width : this.texture.width;
		height = (height===0 || height) ? height : this.texture.height;

		var invTexWidth = 1 / this.texture.width;
		var invTexHeight = 1 / this.texture.height;
		this.setUVs(x * invTexWidth, y * invTexHeight, (x + width) * invTexWidth, (y + height) * invTexHeight);
		this.regionWidth = Math.abs(width);
		this.regionHeight = Math.abs(height);
	},

	/** Sets the texture to that of the specified region and sets the coordinates relative to the specified region. */
	setFromRegion: function(region, x, y, width, height) {
		this.texture = region.texture;
		this.set(region.getRegionX() + x, region.getRegionY() + y, width, height);
	},


	//TODO: add setters for regionX/Y and regionWidth/Height

	regionX: {
		get: function() {
			return Math.round(this.u * this.texture.width);
		} 
	},

	regionY: {
		get: function() {
			return Math.round(this.v * this.texture.height);
		}
	},

	flip: function(x, y) {
		var temp;
		if (x) {
			temp = this.u;
			this.u = this.u2;
			this.u2 = temp;
		}
		if (y) {
			temp = this.v;
			this.v = this.v2;
			this.v2 = temp;
		}
	}
});

module.exports = TextureRegion;
},{"klasse":17}],10:[function(require,module,exports){
/**
 * @module kami
 */

var Class = require('klasse');
var Signal = require('signals');

/**
 * A thin wrapper around WebGLRenderingContext which handles
 * context loss and restore with various rendering objects (textures,
 * shaders and buffers). This also handles general viewport management.
 *
 * If the view is not specified, a canvas will be created.
 *
 * If the `view` parameter is an instanceof WebGLRenderingContext,
 * we will use its canvas and context without fetching another through `getContext`.
 * Passing a canvas that has already had `getContext('webgl')` called will not cause
 * errors, but in certain debuggers (e.g. Chrome WebGL Inspector) only the latest
 * context will be traced.
 * 
 * @class  WebGLContext
 * @constructor
 * @param {Number} width the width of the GL canvas
 * @param {Number} height the height of the GL canvas
 * @param {HTMLCanvasElement} view the optional DOM canvas element
 * @param {Object} contextAttribuets an object containing context attribs which
 *                                   will be used during GL initialization
 */
var WebGLContext = new Class({
	
	initialize: function WebGLContext(width, height, view, contextAttributes) {
		/**
		 * The list of rendering objects (shaders, VBOs, textures, etc) which are 
		 * currently being managed. Any object with a "create" method can be added
		 * to this list. Upon destroying the rendering object, it should be removed.
		 * See addManagedObject and removeManagedObject.
		 * 
		 * @property {Array} managedObjects
		 */
		this.managedObjects = [];

		/**
		 * The actual GL context. You can use this for
		 * raw GL calls or to access GLenum constants. This
		 * will be updated on context restore. While the WebGLContext
		 * is not `valid`, you should not try to access GL state.
		 * 
		 * @property gl
		 * @type {WebGLRenderingContext}
		 */
		this.gl = null;

		if (view && typeof window.WebGLRenderingContext !== "undefined"
				 && view instanceof window.WebGLRenderingContext) {
			view = view.canvas;
			this.gl = view;
			this.valid = true;
			contextAttributes = undefined; //just ignore new attribs...
		}

		/**
		 * The canvas DOM element for this context.
		 * @property {Number} view
		 */
		this.view = view || document.createElement("canvas");

		//default size as per spec:
		//http://www.w3.org/TR/2012/WD-html5-author-20120329/the-canvas-element.html#the-canvas-element
		
		/**
		 * The width of this canvas.
		 *
		 * @property width
		 * @type {Number}
		 */
		this.width = this.view.width = width || 300;

		/**
		 * The height of this canvas.
		 * @property height
		 * @type {Number}
		 */
		this.height = this.view.height = height || 150;


		/**
		 * The context attributes for initializing the GL state. This might include
		 * anti-aliasing, alpha settings, verison, and so forth.
		 * 
		 * @property {Object} contextAttributes 
		 */
		this.contextAttributes = contextAttributes;
		
		/**
		 * Whether this context is 'valid', i.e. renderable. A context that has been lost
		 * (and not yet restored) or destroyed is invalid.
		 * 
		 * @property {Boolean} valid
		 */
		this.valid = false;

		/**
		 * A signal dispatched when GL context is lost. 
		 * 
		 * The first argument passed to the listener is the WebGLContext
		 * managing the context loss.
		 * 
		 * @event {Signal} lost
		 */
		this.lost = new Signal();

		/**
		 * A signal dispatched when GL context is restored, after all the managed
		 * objects have been recreated.
		 *
		 * The first argument passed to the listener is the WebGLContext
		 * which managed the restoration.
		 *
		 * This does not gaurentee that all objects will be renderable.
		 * For example, a Texture with an ImageProvider may still be loading
		 * asynchronously.	 
		 * 
		 * @event {Signal} restored
		 */
		this.restored = new Signal();	
		
		//setup context lost and restore listeners
		this.view.addEventListener("webglcontextlost", function (ev) {
			ev.preventDefault();
			this._contextLost(ev);
		}.bind(this));
		this.view.addEventListener("webglcontextrestored", function (ev) {
			ev.preventDefault();
			this._contextRestored(ev);
		}.bind(this));
			
		if (!this.valid) //would only be valid if WebGLRenderingContext was passed 
			this._initContext();

		this.resize(this.width, this.height);
	},
	
	_initContext: function() {
		var err = "";
		this.valid = false;

		try {
			this.gl = (this.view.getContext('webgl', this.contextAttributes) 
						|| this.view.getContext('experimental-webgl', this.contextAttributes));
		} catch (e) {
			this.gl = null;
		}

		if (this.gl) {
			this.valid = true;
		} else {
			throw "WebGL Context Not Supported -- try enabling it or using a different browser";
		}	
	},

	/**
	 * Updates the width and height of this WebGL context, resizes
	 * the canvas view, and calls gl.viewport() with the new size.
	 * 
	 * @param  {Number} width  the new width
	 * @param  {Number} height the new height
	 */
	resize: function(width, height) {
		this.width = width;
		this.height = height;

		this.view.width = width;
		this.view.height = height;

		var gl = this.gl;
		gl.viewport(0, 0, this.width, this.height);
	},

	/**
	 * (internal use)
	 * A managed object is anything with a "create" function, that will
	 * restore GL state after context loss. 
	 * 
	 * @param {[type]} tex [description]
	 */
	addManagedObject: function(obj) {
		this.managedObjects.push(obj);
	},

	/**
	 * (internal use)
	 * Removes a managed object from the cache. This is useful to destroy
	 * a texture or shader, and have it no longer re-load on context restore.
	 *
	 * Returns the object that was removed, or null if it was not found in the cache.
	 * 
	 * @param  {Object} obj the object to be managed
	 * @return {Object}     the removed object, or null
	 */
	removeManagedObject: function(obj) {
		var idx = this.managedObjects.indexOf(obj);
		if (idx > -1) {
			this.managedObjects.splice(idx, 1);
			return obj;
		} 
		return null;
	},

	/**
	 * Calls destroy() on each managed object, then removes references to these objects
	 * and the GL rendering context. This also removes references to the view and sets
	 * the context's width and height to zero.
	 *
	 * Attempting to use this WebGLContext or the GL rendering context after destroying it
	 * will lead to undefined behaviour.
	 */
	destroy: function() {
		for (var i=0; i<this.managedObjects.length; i++) {
			var obj = this.managedObjects[i];
			if (obj && typeof obj.destroy === "function")
				obj.destroy();
		}
		this.managedObjects.length = 0;
		this.valid = false;
		this.gl = null;
		this.view = null;
		this.width = this.height = 0;
	},

	_contextLost: function(ev) {
		//all textures/shaders/buffers/FBOs have been deleted... 
		//we need to re-create them on restore
		this.valid = false;

		this.lost.dispatch(this);
	},

	_contextRestored: function(ev) {
		//first, initialize the GL context again
		this._initContext();

		//now we recreate our shaders and textures
		for (var i=0; i<this.managedObjects.length; i++) {
			this.managedObjects[i].create();
		}

		//update GL viewport
		this.resize(this.width, this.height);

		this.restored.dispatch(this);
	}
});

module.exports = WebGLContext;
},{"klasse":17,"signals":16}],11:[function(require,module,exports){
var Class = require('klasse');
var Texture = require('../Texture');


var FrameBuffer = new Class({

	/**
	 * Creates a new Frame Buffer Object with the given width and height.
	 *
	 * If width and height are non-numbers, this method expects the
	 * first parameter to be a Texture object which should be acted upon. 
	 * In this case, the FrameBuffer does not "own" the texture, and so it
	 * won't dispose of it upon destruction. This is an advanced version of the
	 * constructor that assumes the user is giving us a valid Texture that can be bound (i.e.
	 * no async Image textures).
	 *
	 * @class  FrameBuffer
	 * @constructor
	 * @param  {[type]} width  [description]
	 * @param  {[type]} height [description]
	 * @param  {[type]} filter [description]
	 * @return {[type]}        [description]
	 */
	initialize: function FrameBuffer(context, width, height, format) { //TODO: depth component
		if (typeof context !== "object")
			throw "GL context not specified to FrameBuffer";
	

		/**
		 * The underlying ID of the GL frame buffer object.
		 *
		 * @property {WebGLFramebuffer} id
		 */		
		this.id = null;

		/**
		 * The WebGLContext backed by this frame buffer.
		 *
		 * @property {WebGLContext} context
		 */
		this.context = context;

		/**
		 * The Texture backed by this frame buffer.
		 *
		 * @property {Texture} Texture
		 */
		//this Texture is now managed.
		this.texture = new Texture(context, width, height, format);

		//This is maanged by WebGLContext
		this.context.addManagedObject(this);
		this.create();
	},

	/**
	 * A read-only property which returns the width of the backing texture. 
	 * 
	 * @readOnly
	 * @property width
	 * @type {Number}
	 */
	width: {
		get: function() {
			return this.texture.width
		}
	},

	/**
	 * A read-only property which returns the height of the backing texture. 
	 * 
	 * @readOnly
	 * @property height
	 * @type {Number}
	 */
	height: {
		get: function() {
			return this.texture.height;
		}
	},


	/**
	 * Called during initialization to setup the frame buffer; also called on
	 * context restore. Users will not need to call this directly.
	 * 
	 * @method create
	 */
	create: function() {
		this.gl = this.context.gl; 
		var gl = this.gl;

		var tex = this.texture;

		//we assume the texture has already had create() called on it
		//since it was added as a managed object prior to this FrameBuffer
		tex.bind();
 
		this.id = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.id);

		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, tex.target, tex.id, 0);

		var result = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
		if (result != gl.FRAMEBUFFER_COMPLETE) {
			this.destroy(); //destroy our resources before leaving this function..

			var err = "Framebuffer not complete";
			switch (result) {
				case gl.FRAMEBUFFER_UNSUPPORTED:
					throw new Error(err + ": unsupported");
				case gl.INCOMPLETE_DIMENSIONS:
					throw new Error(err + ": incomplete dimensions");
				case gl.INCOMPLETE_ATTACHMENT:
					throw new Error(err + ": incomplete attachment");
				case gl.INCOMPLETE_MISSING_ATTACHMENT:
					throw new Error(err + ": missing attachment");
				default:
					throw new Error(err);
			}
		}
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	},


	/**
	 * Destroys this frame buffer. Using this object after destroying it will have
	 * undefined results. 
	 * @method destroy
	 */
	destroy: function() {
		var gl = this.gl;

		if (this.texture)
			this.texture.destroy();
		if (this.id && this.gl)
			this.gl.deleteFramebuffer(this.id);
		if (this.context)
			this.context.removeManagedObject(this);

		this.id = null;
		this.gl = null;
		this.texture = null;
		this.context = null;
	},

	/**
	 * Binds this framebuffer and sets the viewport to the expected size.
	 * @method begin
	 */
	begin: function() {
		var gl = this.gl;
		gl.viewport(0, 0, this.texture.width, this.texture.height);
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.id);
	},

	/**
	 * Binds the default frame buffer (the screen) and sets the viewport back
	 * to the size of the WebGLContext.
	 * 
	 * @method end
	 */
	end: function() {
		var gl = this.gl;
		gl.viewport(0, 0, this.context.width, this.context.height);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	}
});

module.exports = FrameBuffer;
},{"../Texture":8,"klasse":17}],12:[function(require,module,exports){
/**
 * @module kami
 */

var Class = require('klasse');

//TODO: decouple into VBO + IBO utilities 
/**
 * A mesh class that wraps VBO and IBO.
 *
 * @class  Mesh
 */
var Mesh = new Class({


	/**
	 * A write-only property which sets both vertices and indices 
	 * flag to dirty or not. 
	 *
	 * @property dirty
	 * @type {Boolean}
	 * @writeOnly
	 */
	dirty: {
		set: function(val) {
			this.verticesDirty = val;
			this.indicesDirty = val;
		}
	},

	/**
	 * Creates a new Mesh with the provided parameters.
	 *
	 * If numIndices is 0 or falsy, no index buffer will be used
	 * and indices will be an empty ArrayBuffer and a null indexBuffer.
	 * 
	 * If isStatic is true, then vertexUsage and indexUsage will
	 * be set to gl.STATIC_DRAW. Otherwise they will use gl.DYNAMIC_DRAW.
	 * You may want to adjust these after initialization for further control.
	 * 
	 * @param  {WebGLContext}  context the context for management
	 * @param  {Boolean} isStatic      a hint as to whether this geometry is static
	 * @param  {[type]}  numVerts      [description]
	 * @param  {[type]}  numIndices    [description]
	 * @param  {[type]}  vertexAttribs [description]
	 * @return {[type]}                [description]
	 */
	initialize: function Mesh(context, isStatic, numVerts, numIndices, vertexAttribs) {
		if (typeof context !== "object")
			throw "GL context not specified to Mesh";
		if (!numVerts)
			throw "numVerts not specified, must be > 0";

		this.context = context;
		this.gl = context.gl;
		
		this.numVerts = null;
		this.numIndices = null;
		
		this.vertices = null;
		this.indices = null;
		this.vertexBuffer = null;
		this.indexBuffer = null;

		this.verticesDirty = true;
		this.indicesDirty = true;
		this.indexUsage = null;
		this.vertexUsage = null;

		/** 
		 * @property
		 * @private
		 */
		this._vertexAttribs = null;

		/** 
		 * The stride for one vertex _in bytes_. 
		 * 
		 * @property {Number} vertexStride
		 */
		this.vertexStride = null;

		this.numVerts = numVerts;
		this.numIndices = numIndices || 0;
		this.vertexUsage = isStatic ? this.gl.STATIC_DRAW : this.gl.DYNAMIC_DRAW;
		this.indexUsage  = isStatic ? this.gl.STATIC_DRAW : this.gl.DYNAMIC_DRAW;
		this._vertexAttribs = vertexAttribs || [];
		
		this.indicesDirty = true;
		this.verticesDirty = true;

		//determine the vertex stride based on given attributes
		var totalNumComponents = 0;
		for (var i=0; i<this._vertexAttribs.length; i++)
			totalNumComponents += this._vertexAttribs[i].offsetCount;
		this.vertexStride = totalNumComponents * 4; // in bytes

		this.vertices = new Float32Array(this.numVerts);
		this.indices = new Uint16Array(this.numIndices);

		//add this VBO to the managed cache
		this.context.addManagedObject(this);

		this.create();
	},

	//recreates the buffers on context loss
	create: function() {
		this.gl = this.context.gl;
		var gl = this.gl;
		this.vertexBuffer = gl.createBuffer();

		//ignore index buffer if we haven't specified any
		this.indexBuffer = this.numIndices > 0
					? gl.createBuffer()
					: null;

		this.dirty = true;
	},

	destroy: function() {
		this.vertices = null;
		this.indices = null;
		if (this.vertexBuffer && this.gl)
			this.gl.deleteBuffer(this.vertexBuffer);
		if (this.indexBuffer && this.gl)
			this.gl.deleteBuffer(this.indexBuffer);
		this.vertexBuffer = null;
		this.indexBuffer = null;
		if (this.context)
			this.context.removeManagedObject(this);
		this.gl = null;
		this.context = null;
	},

	_updateBuffers: function(ignoreBind, subDataLength) {
		var gl = this.gl;

		//bind our index data, if we have any
		if (this.numIndices > 0) {
			if (!ignoreBind)
				gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);

			//update the index data
			if (this.indicesDirty) {
				gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, this.indexUsage);
				this.indicesDirty = false;
			}
		}

		//bind our vertex data
		if (!ignoreBind)
			gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);

		//update our vertex data
		if (this.verticesDirty) {
			if (subDataLength) {
				// TODO: When decoupling VBO/IBO be sure to give better subData support..
				var view = this.vertices.subarray(0, subDataLength);
				gl.bufferSubData(gl.ARRAY_BUFFER, 0, view);
			} else {
				gl.bufferData(gl.ARRAY_BUFFER, this.vertices, this.vertexUsage);	
			}

			
			this.verticesDirty = false;
		}
	},

	draw: function(primitiveType, count, offset, subDataLength) {
		if (count === 0)
			return;

		var gl = this.gl;
		
		offset = offset || 0;

		//binds and updates our buffers. pass ignoreBind as true
		//to avoid binding unnecessarily
		this._updateBuffers(true, subDataLength);

		if (this.numIndices > 0) { 
			gl.drawElements(primitiveType, count, 
						gl.UNSIGNED_SHORT, offset * 2); //* Uint16Array.BYTES_PER_ELEMENT
		} else
			gl.drawArrays(primitiveType, offset, count);
	},

	//binds this mesh's vertex attributes for the given shader
	bind: function(shader) {
		var gl = this.gl;

		var offset = 0;
		var stride = this.vertexStride;

		//bind and update our vertex data before binding attributes
		this._updateBuffers();

		//for each attribtue
		for (var i=0; i<this._vertexAttribs.length; i++) {
			var a = this._vertexAttribs[i];

			//location of the attribute
			var loc = a.location === null 
					? shader.getAttributeLocation(a.name)
					: a.location;

			//TODO: We may want to skip unfound attribs
			// if (loc!==0 && !loc)
			// 	console.warn("WARN:", a.name, "is not enabled");

			//first, enable the vertex array
			gl.enableVertexAttribArray(loc);

			//then specify our vertex format
			gl.vertexAttribPointer(loc, a.numComponents, a.type || gl.FLOAT, 
								   a.normalize, stride, offset);

			//and increase the offset...
			offset += a.offsetCount * 4; //in bytes
		}
	},

	unbind: function(shader) {
		var gl = this.gl;

		//for each attribtue
		for (var i=0; i<this._vertexAttribs.length; i++) {
			var a = this._vertexAttribs[i];

			//location of the attribute
			var loc = a.location === null 
					? shader.getAttributeLocation(a.name)
					: a.location;

			//first, enable the vertex array
			gl.disableVertexAttribArray(loc);
		}
	}
});

Mesh.Attrib = new Class({

	name: null,
	numComponents: null,
	location: null,
	type: null,

	/**
	 * Location is optional and for advanced users that
	 * want vertex arrays to match across shaders. Any non-numerical
	 * value will be converted to null, and ignored. If a numerical
	 * value is given, it will override the position of this attribute
	 * when given to a mesh.
	 * 
	 * @param  {[type]} name          [description]
	 * @param  {[type]} numComponents [description]
	 * @param  {[type]} location      [description]
	 * @return {[type]}               [description]
	 */
	initialize: function(name, numComponents, location, type, normalize, offsetCount) {
		this.name = name;
		this.numComponents = numComponents;
		this.location = typeof location === "number" ? location : null;
		this.type = type;
		this.normalize = Boolean(normalize);
		this.offsetCount = typeof offsetCount === "number" ? offsetCount : this.numComponents;
	}
})


module.exports = Mesh;
},{"klasse":17}],13:[function(require,module,exports){
/**
 * @module kami
 */

var Class = require('klasse');


var ShaderProgram = new Class({
	
	/**
	 * Creates a new ShaderProgram from the given source, and an optional map of attribute
	 * locations as <name, index> pairs.
	 *
	 * _Note:_ Chrome version 31 was giving me issues with attribute locations -- you may
	 * want to omit this to let the browser pick the locations for you.	
	 *
	 * @class  ShaderProgram
	 * @constructor
	 * @param  {WebGLContext} context      the context to manage this object
	 * @param  {String} vertSource         the vertex shader source
	 * @param  {String} fragSource         the fragment shader source
	 * @param  {Object} attributeLocations the attribute locations
	 */
	initialize: function ShaderProgram(context, vertSource, fragSource, attributeLocations) {
		if (!vertSource || !fragSource)
			throw "vertex and fragment shaders must be defined";
		if (typeof context !== "object")
			throw "GL context not specified to ShaderProgram";
		this.context = context;

		this.vertShader = null;
		this.fragShader = null;
		this.program = null;
		this.log = "";

		this.uniformCache = null;
		this.attributeCache = null;

		this.attributeLocations = attributeLocations;

		//We trim (ECMAScript5) so that the GLSL line numbers are
		//accurate on shader log
		this.vertSource = vertSource.trim();
		this.fragSource = fragSource.trim();

		//Adds this shader to the context, to be managed
		this.context.addManagedObject(this);

		this.create();
	},

	/** 
	 * This is called during the ShaderProgram constructor,
	 * and may need to be called again after context loss and restore.
	 * 
	 * @method  create
	 */
	create: function() {
		this.gl = this.context.gl;
		this._compileShaders();
	},

	//Compiles the shaders, throwing an error if the program was invalid.
	_compileShaders: function() {
		var gl = this.gl; 
		
		this.log = "";

		this.vertShader = this._loadShader(gl.VERTEX_SHADER, this.vertSource);
		this.fragShader = this._loadShader(gl.FRAGMENT_SHADER, this.fragSource);

		if (!this.vertShader || !this.fragShader)
			throw "Error returned when calling createShader";

		this.program = gl.createProgram();

		gl.attachShader(this.program, this.vertShader);
		gl.attachShader(this.program, this.fragShader);
	
		//TODO: This seems not to be working on my OSX -- maybe a driver bug?
		if (this.attributeLocations) {
			for (var key in this.attributeLocations) {
				if (this.attributeLocations.hasOwnProperty(key)) {
					gl.bindAttribLocation(this.program, Math.floor(this.attributeLocations[key]), key);
				}
			}
		}

		gl.linkProgram(this.program); 

		this.log += gl.getProgramInfoLog(this.program) || "";

		if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
			throw "Error linking the shader program:\n"
				+ this.log;
		}

		this._fetchUniforms();
		this._fetchAttributes();
	},

	_fetchUniforms: function() {
		var gl = this.gl;

		this.uniformCache = {};

		var len = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS);
		if (!len) //null or zero
			return;

		for (var i=0; i<len; i++) {
			var info = gl.getActiveUniform(this.program, i);
			if (info === null) 
				continue;
			var name = info.name;
			var location = gl.getUniformLocation(this.program, name);
			
			this.uniformCache[name] = {
				size: info.size,
				type: info.type,
				location: location
			};
		}
	},

	_fetchAttributes: function() { 
		var gl = this.gl; 

		this.attributeCache = {};

		var len = gl.getProgramParameter(this.program, gl.ACTIVE_ATTRIBUTES);
		if (!len) //null or zero
			return;	

		for (var i=0; i<len; i++) {
			var info = gl.getActiveAttrib(this.program, i);
			if (info === null) 
				continue;
			var name = info.name;

			//the attrib location is a simple index
			var location = gl.getAttribLocation(this.program, name);
			
			this.attributeCache[name] = {
				size: info.size,
				type: info.type,
				location: location
			};
		}
	},

	_loadShader: function(type, source) {
		var gl = this.gl;

		var shader = gl.createShader(type);
		if (!shader) //should not occur...
			return -1;

		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		
		var logResult = gl.getShaderInfoLog(shader) || "";
		if (logResult) {
			//we do this so the user knows which shader has the error
			var typeStr = (type === gl.VERTEX_SHADER) ? "vertex" : "fragment";
			logResult = "Error compiling "+ typeStr+ " shader:\n"+logResult;
		}

		this.log += logResult;

		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) ) {
			throw this.log;
		}
		return shader;
	},

	/**
	 * Called to bind this shader. Note that there is no "unbind" since
	 * technically such a thing is not possible in the programmable pipeline.
	 *
	 * You must bind a shader before settings its uniforms.
	 * 
	 * @method bind
	 */
	bind: function() {
		this.gl.useProgram(this.program);
	},


	/**
	 * Destroys this shader and its resources. You should not try to use this
	 * after destroying it.
	 * @method  destroy
	 */
	destroy: function() {
		if (this.context)
			this.context.removeManagedObject(this);

		if (this.gl && this.program) {
			var gl = this.gl;
			gl.detachShader(this.program, this.vertShader);
			gl.detachShader(this.program, this.fragShader);

			gl.deleteShader(this.vertShader);
			gl.deleteShader(this.fragShader);
			gl.deleteProgram(this.program);
		}
		this.attributeCache = null;
		this.uniformCache = null;
		this.vertShader = null;
		this.fragShader = null;
		this.program = null;
		this.gl = null;
		this.context = null;
	},


	/**
	 * Returns the cached uniform info (size, type, location).
	 * If the uniform is not found in the cache, it is assumed
	 * to not exist, and this method returns null.
	 *
	 * This may return null even if the uniform is defined in GLSL:
	 * if it is _inactive_ (i.e. not used in the program) then it may
	 * be optimized out.
	 *
	 * @method  getUniformInfo
	 * @param  {String} name the uniform name as defined in GLSL
	 * @return {Object} an object containing location, size, and type
	 */
	getUniformInfo: function(name) {
		return this.uniformCache[name] || null; 
	},

	/**
	 * Returns the cached attribute info (size, type, location).
	 * If the attribute is not found in the cache, it is assumed
	 * to not exist, and this method returns null.
	 *
	 * This may return null even if the attribute is defined in GLSL:
	 * if it is _inactive_ (i.e. not used in the program or disabled) 
	 * then it may be optimized out.
	 *
	 * @method  getAttributeInfo
	 * @param  {String} name the attribute name as defined in GLSL
	 * @return {object} an object containing location, size and type
	 */
	getAttributeInfo: function(name) {
		return this.attributeCache[name] || null; 
	},


	/**
	 * Returns the cached uniform location object.
	 * If the uniform is not found, this method returns null.
	 *
	 * @method  getAttributeLocation
	 * @param  {String} name the uniform name as defined in GLSL
	 * @return {GLint} the location object
	 */
	getAttributeLocation: function(name) { //TODO: make faster, don't cache
		var info = this.getAttributeInfo(name);
		return info ? info.location : null;
	},

	/**
	 * Returns the cached uniform location object, assuming it exists
	 * and is active. Note that uniforms may be inactive if 
	 * the GLSL compiler deemed them unused.
	 *
	 * @method  getUniformLocation
	 * @param  {String} name the uniform name as defined in GLSL
	 * @return {WebGLUniformLocation} the location object
	 */
	getUniformLocation: function(name) {
		var info = this.getUniformInfo(name);
		return info ? info.location : null;
	},

	/**
	 * Returns true if the uniform is active and found in this
	 * compiled program. Note that uniforms may be inactive if 
	 * the GLSL compiler deemed them unused.
	 *
	 * @method  hasUniform
	 * @param  {String}  name the uniform name
	 * @return {Boolean} true if the uniform is found and active
	 */
	hasUniform: function(name) {
		return this.getUniformInfo(name) !== null;
	},

	/**
	 * Returns true if the attribute is active and found in this
	 * compiled program.
	 *
	 * @method  hasAttribute
	 * @param  {String}  name the attribute name
	 * @return {Boolean} true if the attribute is found and active
	 */
	hasAttribute: function(name) {
		return this.getAttributeInfo(name) !== null;
	},

	/**
	 * Returns the uniform value by name.
	 *
	 * @method  getUniform
	 * @param  {String} name the uniform name as defined in GLSL
	 * @return {any} The value of the WebGL uniform
	 */
	getUniform: function(name) {
		return this.gl.getUniform(this.program, this.getUniformLocation(name));
	},

	/**
	 * Returns the uniform value at the specified WebGLUniformLocation.
	 *
	 * @method  getUniformAt
	 * @param  {WebGLUniformLocation} location the location object
	 * @return {any} The value of the WebGL uniform
	 */
	getUniformAt: function(location) {
		return this.gl.getUniform(this.program, location);
	},

	/**
	 * A convenience method to set uniformi from the given arguments.
	 * We determine which GL call to make based on the number of arguments
	 * passed. For example, `setUniformi("var", 0, 1)` maps to `gl.uniform2i`.
	 * 
	 * @method  setUniformi
	 * @param {String} name        		the name of the uniform
	 * @param {GLint} x  the x component for ints
	 * @param {GLint} y  the y component for ivec2
	 * @param {GLint} z  the z component for ivec3
	 * @param {GLint} w  the w component for ivec4
	 */
	setUniformi: function(name, x, y, z, w) {
		'use strict';
		var gl = this.gl;
		var loc = this.getUniformLocation(name);
		if (loc === null)
			return false;
		switch (arguments.length) {
			case 2: gl.uniform1i(loc, x); return true;
			case 3: gl.uniform2i(loc, x, y); return true;
			case 4: gl.uniform3i(loc, x, y, z); return true;
			case 5: gl.uniform4i(loc, x, y, z, w); return true;
			default:
				throw "invalid arguments to setUniformi"; 
		}
	},

	/**
	 * A convenience method to set uniformf from the given arguments.
	 * We determine which GL call to make based on the number of arguments
	 * passed. For example, `setUniformf("var", 0, 1)` maps to `gl.uniform2f`.
	 * 
	 * @method  setUniformf
	 * @param {String} name        		the name of the uniform
	 * @param {GLfloat} x  the x component for floats
	 * @param {GLfloat} y  the y component for vec2
	 * @param {GLfloat} z  the z component for vec3
	 * @param {GLfloat} w  the w component for vec4
	 */
	setUniformf: function(name, x, y, z, w) {
		'use strict';
		var gl = this.gl;
		var loc = this.getUniformLocation(name);
		if (loc === null)
			return false;
		switch (arguments.length) {
			case 2: gl.uniform1f(loc, x); return true;
			case 3: gl.uniform2f(loc, x, y); return true;
			case 4: gl.uniform3f(loc, x, y, z); return true;
			case 5: gl.uniform4f(loc, x, y, z, w); return true;
			default:
				throw "invalid arguments to setUniformf"; 
		}
	},

	//I guess we won't support sequence<GLfloat> .. whatever that is ??
	

	///// 
	
	/**
	 * A convenience method to set uniformNfv from the given ArrayBuffer.
	 * We determine which GL call to make based on the length of the array 
	 * buffer (for 1-4 component vectors stored in a Float32Array). To use
	 * this method to upload data to uniform arrays, you need to specify the
	 * 'count' parameter; i.e. the data type you are using for that array. If
	 * specified, this will dictate whether to call uniform1fv, uniform2fv, etc.
	 *
	 * @method  setUniformfv
	 * @param {String} name        		the name of the uniform
	 * @param {ArrayBuffer} arrayBuffer the array buffer
	 * @param {Number} count            optional, the explicit data type count, e.g. 2 for vec2
	 */
	setUniformfv: function(name, arrayBuffer, count) {
		'use strict';
		count = count || arrayBuffer.length;
		var gl = this.gl;
		var loc = this.getUniformLocation(name);
		if (loc === null)
			return false;
		switch (count) {
			case 1: gl.uniform1fv(loc, arrayBuffer); return true;
			case 2: gl.uniform2fv(loc, arrayBuffer); return true;
			case 3: gl.uniform3fv(loc, arrayBuffer); return true;
			case 4: gl.uniform4fv(loc, arrayBuffer); return true;
			default:
				throw "invalid arguments to setUniformf"; 
		}
	},

	/**
	 * A convenience method to set uniformNiv from the given ArrayBuffer.
	 * We determine which GL call to make based on the length of the array 
	 * buffer (for 1-4 component vectors stored in a int array). To use
	 * this method to upload data to uniform arrays, you need to specify the
	 * 'count' parameter; i.e. the data type you are using for that array. If
	 * specified, this will dictate whether to call uniform1fv, uniform2fv, etc.
	 *
	 * @method  setUniformiv
	 * @param {String} name        		the name of the uniform
	 * @param {ArrayBuffer} arrayBuffer the array buffer
	 * @param {Number} count            optional, the explicit data type count, e.g. 2 for ivec2
	 */
	setUniformiv: function(name, arrayBuffer, count) {
		'use strict';
		count = count || arrayBuffer.length;
		var gl = this.gl;
		var loc = this.getUniformLocation(name);
		if (loc === null)
			return false;
		switch (count) {
			case 1: gl.uniform1iv(loc, arrayBuffer); return true;
			case 2: gl.uniform2iv(loc, arrayBuffer); return true;
			case 3: gl.uniform3iv(loc, arrayBuffer); return true;
			case 4: gl.uniform4iv(loc, arrayBuffer); return true;
			default:
				throw "invalid arguments to setUniformf"; 
		}
	},

	/**
	 * This is a convenience function to pass a Matrix3 (from vecmath,
	 * kami's preferred math library) or a Float32Array (e.g. gl-matrix)
	 * to a shader. If mat is an object with "val", it is considered to be
	 * a Matrix3, otherwise assumed to be a typed array being passed directly
	 * to the shader.
	 * 
	 * @param {String} name the uniform name
	 * @param {Matrix3|Float32Array} mat a Matrix3 or Float32Array
	 * @param {Boolean} transpose whether to transpose the matrix, default false
	 */
	setUniformMatrix3: function(name, mat, transpose) {
		'use strict';
		var arr = typeof mat === "object" && mat.val ? mat.val : mat;
		transpose = !!transpose; //to boolean

		var gl = this.gl;
		var loc = this.getUniformLocation(name);
		if (loc === null)
			return false;
		gl.uniformMatrix3fv(loc, transpose, arr)
	},

	/**
	 * This is a convenience function to pass a Matrix4 (from vecmath,
	 * kami's preferred math library) or a Float32Array (e.g. gl-matrix)
	 * to a shader. If mat is an object with "val", it is considered to be
	 * a Matrix4, otherwise assumed to be a typed array being passed directly
	 * to the shader.
	 * 
	 * @param {String} name the uniform name
	 * @param {Matrix4|Float32Array} mat a Matrix4 or Float32Array
	 * @param {Boolean} transpose whether to transpose the matrix, default false
	 */
	setUniformMatrix4: function(name, mat, transpose) {
		'use strict';
		var arr = typeof mat === "object" && mat.val ? mat.val : mat;
		transpose = !!transpose; //to boolean

		var gl = this.gl;
		var loc = this.getUniformLocation(name);
		if (loc === null)
			return false;
		gl.uniformMatrix4fv(loc, transpose, arr)
	} 
 
});

//Some default attribute names that parts of kami will use
//when creating a standard shader.
ShaderProgram.POSITION_ATTRIBUTE = "Position";
ShaderProgram.NORMAL_ATTRIBUTE = "Normal";
ShaderProgram.COLOR_ATTRIBUTE = "Color";
ShaderProgram.TEXCOORD_ATTRIBUTE = "TexCoord";

module.exports = ShaderProgram;
},{"klasse":17}],14:[function(require,module,exports){
/**
  Auto-generated Kami index file.
  Created on 2014-06-11.
*/
module.exports = {
    //core classes
    'BaseBatch':       require('./BaseBatch.js'),
    'SpriteBatch':     require('./SpriteBatch.js'),
    'Texture':         require('./Texture.js'),
    'TextureRegion':   require('./TextureRegion.js'),
    'WebGLContext':    require('./WebGLContext.js'),
    'FrameBuffer':     require('./glutils/FrameBuffer.js'),
    'Mesh':            require('./glutils/Mesh.js'),
    'ShaderProgram':   require('./glutils/ShaderProgram.js')
};
},{"./BaseBatch.js":6,"./SpriteBatch.js":7,"./Texture.js":8,"./TextureRegion.js":9,"./WebGLContext.js":10,"./glutils/FrameBuffer.js":11,"./glutils/Mesh.js":12,"./glutils/ShaderProgram.js":13}],15:[function(require,module,exports){
var int8 = new Int8Array(4);
var int32 = new Int32Array(int8.buffer, 0, 1);
var float32 = new Float32Array(int8.buffer, 0, 1);

/**
 * A singleton for number utilities. 
 * @class NumberUtil
 */
var NumberUtil = function() {

};


/**
 * Returns a float representation of the given int bits. ArrayBuffer
 * is used for the conversion.
 *
 * @method  intBitsToFloat
 * @static
 * @param  {Number} i the int to cast
 * @return {Number}   the float
 */
NumberUtil.intBitsToFloat = function(i) {
	int32[0] = i;
	return float32[0];
};

/**
 * Returns the int bits from the given float. ArrayBuffer is used
 * for the conversion.
 *
 * @method  floatToIntBits
 * @static
 * @param  {Number} f the float to cast
 * @return {Number}   the int bits
 */
NumberUtil.floatToIntBits = function(f) {
	float32[0] = f;
	return int32[0];
};

/**
 * Encodes ABGR int as a float, with slight precision loss.
 *
 * @method  intToFloatColor
 * @static
 * @param {Number} value an ABGR packed integer
 */
NumberUtil.intToFloatColor = function(value) {
	return NumberUtil.intBitsToFloat( value & 0xfeffffff );
};

/**
 * Returns a float encoded ABGR value from the given RGBA
 * bytes (0 - 255). Useful for saving bandwidth in vertex data.
 *
 * @method  colorToFloat
 * @static
 * @param {Number} r the Red byte (0 - 255)
 * @param {Number} g the Green byte (0 - 255)
 * @param {Number} b the Blue byte (0 - 255)
 * @param {Number} a the Alpha byte (0 - 255)
 * @return {Float32}  a Float32 of the RGBA color
 */
NumberUtil.colorToFloat = function(r, g, b, a) {
	var bits = (a << 24 | b << 16 | g << 8 | r);
	return NumberUtil.intToFloatColor(bits);
};

/**
 * Returns true if the number is a power-of-two.
 *
 * @method  isPowerOfTwo
 * @param  {Number}  n the number to test
 * @return {Boolean}   true if power-of-two
 */
NumberUtil.isPowerOfTwo = function(n) {
	return (n & (n - 1)) === 0;
};

/**
 * Returns the next highest power-of-two from the specified number. 
 * 
 * @param  {Number} n the number to test
 * @return {Number}   the next highest power of two
 */
NumberUtil.nextPowerOfTwo = function(n) {
	n--;
	n |= n >> 1;
	n |= n >> 2;
	n |= n >> 4;
	n |= n >> 8;
	n |= n >> 16;
	return n+1;
};

module.exports = NumberUtil;
},{}],16:[function(require,module,exports){
module.exports=require(5)
},{}],17:[function(require,module,exports){
function hasGetterOrSetter(def) {
	return (!!def.get && typeof def.get === "function") || (!!def.set && typeof def.set === "function");
}

function getProperty(definition, k, isClassDescriptor) {
	//This may be a lightweight object, OR it might be a property
	//that was defined previously.
	
	//For simple class descriptors we can just assume its NOT previously defined.
	var def = isClassDescriptor 
				? definition[k] 
				: Object.getOwnPropertyDescriptor(definition, k);

	if (!isClassDescriptor && def.value && typeof def.value === "object") {
		def = def.value;
	}


	//This might be a regular property, or it may be a getter/setter the user defined in a class.
	if ( def && hasGetterOrSetter(def) ) {
		if (typeof def.enumerable === "undefined")
			def.enumerable = true;
		if (typeof def.configurable === "undefined")
			def.configurable = true;
		return def;
	} else {
		return false;
	}
}

function hasNonConfigurable(obj, k) {
	var prop = Object.getOwnPropertyDescriptor(obj, k);
	if (!prop)
		return false;

	if (prop.value && typeof prop.value === "object")
		prop = prop.value;

	if (prop.configurable === false) 
		return true;

	return false;
}

//TODO: On create, 
//		On mixin, 

function extend(ctor, definition, isClassDescriptor, extend) {
	for (var k in definition) {
		if (!definition.hasOwnProperty(k))
			continue;

		var def = getProperty(definition, k, isClassDescriptor);

		if (def !== false) {
			//If Extends is used, we will check its prototype to see if 
			//the final variable exists.
			
			var parent = extend || ctor;
			if (hasNonConfigurable(parent.prototype, k)) {

				//just skip the final property
				if (Class.ignoreFinals)
					continue;

				//We cannot re-define a property that is configurable=false.
				//So we will consider them final and throw an error. This is by
				//default so it is clear to the developer what is happening.
				//You can set ignoreFinals to true if you need to extend a class
				//which has configurable=false; it will simply not re-define final properties.
				throw new Error("cannot override final property '"+k
							+"', set Class.ignoreFinals = true to skip");
			}

			Object.defineProperty(ctor.prototype, k, def);
		} else {
			ctor.prototype[k] = definition[k];
		}

	}
}

/**
 */
function mixin(myClass, mixins) {
	if (!mixins)
		return;

	if (!Array.isArray(mixins))
		mixins = [mixins];

	for (var i=0; i<mixins.length; i++) {
		extend(myClass, mixins[i].prototype || mixins[i]);
	}
}

/**
 * Creates a new class with the given descriptor.
 * The constructor, defined by the name `initialize`,
 * is an optional function. If unspecified, an anonymous
 * function will be used which calls the parent class (if
 * one exists). 
 *
 * You can also use `Extends` and `Mixins` to provide subclassing
 * and inheritance.
 *
 * @class  Class
 * @constructor
 * @param {Object} definition a dictionary of functions for the class
 * @example
 *
 * 		var MyClass = new Class({
 * 		
 * 			initialize: function() {
 * 				this.foo = 2.0;
 * 			},
 *
 * 			bar: function() {
 * 				return this.foo + 5;
 * 			}
 * 		});
 */
function Class(definition) {
	if (!definition)
		definition = {};

	//The variable name here dictates what we see in Chrome debugger
	var initialize;
	var Extends;

	if (definition.initialize) {
		if (typeof definition.initialize !== "function")
			throw new Error("initialize must be a function");
		initialize = definition.initialize;

		//Usually we should avoid "delete" in V8 at all costs.
		//However, its unlikely to make any performance difference
		//here since we only call this on class creation (i.e. not object creation).
		delete definition.initialize;
	} else {
		if (definition.Extends) {
			var base = definition.Extends;
			initialize = function () {
				base.apply(this, arguments);
			}; 
		} else {
			initialize = function () {}; 
		}
	}

	if (definition.Extends) {
		initialize.prototype = Object.create(definition.Extends.prototype);
		initialize.prototype.constructor = initialize;
		//for getOwnPropertyDescriptor to work, we need to act
		//directly on the Extends (or Mixin)
		Extends = definition.Extends;
		delete definition.Extends;
	} else {
		initialize.prototype.constructor = initialize;
	}

	//Grab the mixins, if they are specified...
	var mixins = null;
	if (definition.Mixins) {
		mixins = definition.Mixins;
		delete definition.Mixins;
	}

	//First, mixin if we can.
	mixin(initialize, mixins);

	//Now we grab the actual definition which defines the overrides.
	extend(initialize, definition, true, Extends);

	return initialize;
};

Class.extend = extend;
Class.mixin = mixin;
Class.ignoreFinals = false;

module.exports = Class;
},{}],18:[function(require,module,exports){
/*
 * raf.js
 * https://github.com/ngryman/raf.js
 *
 * original requestAnimationFrame polyfill by Erik Möller
 * inspired from paul_irish gist and post
 *
 * Copyright (c) 2013 ngryman
 * Licensed under the MIT license.
 */

(function(window) {
	var lastTime = 0,
		vendors = ['webkit', 'moz'],
		requestAnimationFrame = window.requestAnimationFrame,
		cancelAnimationFrame = window.cancelAnimationFrame,
		i = vendors.length;

	// try to un-prefix existing raf
	while (--i >= 0 && !requestAnimationFrame) {
		requestAnimationFrame = window[vendors[i] + 'RequestAnimationFrame'];
		cancelAnimationFrame = window[vendors[i] + 'CancelAnimationFrame'];
	}

	// polyfill with setTimeout fallback
	// heavily inspired from @darius gist mod: https://gist.github.com/paulirish/1579671#comment-837945
	if (!requestAnimationFrame || !cancelAnimationFrame) {
		requestAnimationFrame = function(callback) {
			var now = Date.now(), nextTime = Math.max(lastTime + 16, now);
			return setTimeout(function() {
				callback(lastTime = nextTime);
			}, nextTime - now);
		};

		cancelAnimationFrame = clearTimeout;
	}

	// export to window
	window.requestAnimationFrame = requestAnimationFrame;
	window.cancelAnimationFrame = cancelAnimationFrame;
}(window));
},{}],19:[function(require,module,exports){
var domready = require('domready');

var WebGLContext = require('kami').WebGLContext;
var Texture = require('kami').Texture;
var SpriteBatch = require('kami').SpriteBatch;

//include the kami-specific AssetLoader
var AssetLoader = require('kami-assets');

//include polyfill for requestAnimationFrame
require('raf.js');

domready(function() {
    //Create a new WebGL canvas with the given size
    var context = new WebGLContext(256, 256);

    //the 'view' is the DOM canvas, so we can just append it to our body
    document.body.appendChild( context.view );

    //We use SpriteBatch to draw textures as 2D quads
    var batch = new SpriteBatch(context);
    
    //pass the context to the asset loader so it can be managed correctly 
    var assets = new AssetLoader(context);
    
    //add some DOM text
    var text = document.createElement("div");
    document.body.appendChild(text);

    //add some listeners...
    assets.loadStarted.add(function(ev) {
        text.innerHTML = "Load started";
    });
    assets.loadProgress.add(function(ev) {
        text.innerHTML = "Progress: "+ev.current + " / " + ev.total;
    });
    assets.loadFinished.add(function(ev) {
        text.innerHTML = "Load finished";
    })

    //These return a Texture object
    var scene = assets.add("img/scene.png");
    var grass = assets.add("img/grass.png");
    var guy   = assets.add("img/guy.png");
    grass.setFilter(Texture.Filter.LINEAR);
    //make the queue a bit longer...
    var tex = new Texture(context);
    for (var i=0; i<50; i++) {
        //we can specify a key, URL, and reusable Texture object to act on
        //We specify a filename so it can find the image loader easily
        assets.add("img"+i+".png", "img/grass.png", tex);
    }

    function render() {
        requestAnimationFrame(render);
        //get the GL rendering context
        var gl = context.gl;

        //clear canvas with opaque black
        gl.clearColor(0,0,0,1);
        gl.clear(gl.COLOR_BUFFER_BIT);            

        //this will start loading the next task on the queue,
        //and only returns true once all assets have finished loading
        if ( assets.update() ) {
            batch.begin();
            batch.draw(grass, 0, 0);
            batch.draw(guy, 25, 25, guy.width*2, guy.height*2);
            batch.end();
        } 
    }

    //Here we can simulate context loss / restore and how it plays with AssetLoader
    var loseCtx = context.gl.getExtension("WEBGL_lose_context");
    if (loseCtx) {
        var desc = document.createElement("div");
        desc.innerHTML = "Click the canvas to simulate context loss";
        document.body.appendChild(desc);

        context.view.addEventListener("mousedown", function() {
            loseCtx.loseContext();
            context.view.style.visibility = "hidden";
            text.style.visibility = "hidden";

            setTimeout(function() {
                context.view.style.visibility = "visible";
                text.style.visibility = "visible";
                loseCtx.restoreContext();
            }, 1000);
        }, true);
    }

    requestAnimationFrame(render);
});
},{"domready":1,"kami":14,"kami-assets":2,"raf.js":18}]},{},[19])
//@ sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvcHJvamVjdHMvbnBtdXRpbHMva2FtaS1kZW1vcy9ub2RlX21vZHVsZXMvZG9tcmVhZHkvcmVhZHkuanMiLCIvcHJvamVjdHMvbnBtdXRpbHMva2FtaS1kZW1vcy9ub2RlX21vZHVsZXMva2FtaS1hc3NldHMvaW5kZXguanMiLCIvcHJvamVjdHMvbnBtdXRpbHMva2FtaS1kZW1vcy9ub2RlX21vZHVsZXMva2FtaS1hc3NldHMvbm9kZV9tb2R1bGVzL2Fzc2V0bG9hZGVyL2V4dC9JbWFnZUxvYWRlci5qcyIsIi9wcm9qZWN0cy9ucG11dGlscy9rYW1pLWRlbW9zL25vZGVfbW9kdWxlcy9rYW1pLWFzc2V0cy9ub2RlX21vZHVsZXMvYXNzZXRsb2FkZXIvaW5kZXguanMiLCIvcHJvamVjdHMvbnBtdXRpbHMva2FtaS1kZW1vcy9ub2RlX21vZHVsZXMva2FtaS1hc3NldHMvbm9kZV9tb2R1bGVzL2Fzc2V0bG9hZGVyL25vZGVfbW9kdWxlcy9zaWduYWxzL2Rpc3Qvc2lnbmFscy5qcyIsIi9wcm9qZWN0cy9ucG11dGlscy9rYW1pLWRlbW9zL25vZGVfbW9kdWxlcy9rYW1pL2xpYi9CYXNlQmF0Y2guanMiLCIvcHJvamVjdHMvbnBtdXRpbHMva2FtaS1kZW1vcy9ub2RlX21vZHVsZXMva2FtaS9saWIvU3ByaXRlQmF0Y2guanMiLCIvcHJvamVjdHMvbnBtdXRpbHMva2FtaS1kZW1vcy9ub2RlX21vZHVsZXMva2FtaS9saWIvVGV4dHVyZS5qcyIsIi9wcm9qZWN0cy9ucG11dGlscy9rYW1pLWRlbW9zL25vZGVfbW9kdWxlcy9rYW1pL2xpYi9UZXh0dXJlUmVnaW9uLmpzIiwiL3Byb2plY3RzL25wbXV0aWxzL2thbWktZGVtb3Mvbm9kZV9tb2R1bGVzL2thbWkvbGliL1dlYkdMQ29udGV4dC5qcyIsIi9wcm9qZWN0cy9ucG11dGlscy9rYW1pLWRlbW9zL25vZGVfbW9kdWxlcy9rYW1pL2xpYi9nbHV0aWxzL0ZyYW1lQnVmZmVyLmpzIiwiL3Byb2plY3RzL25wbXV0aWxzL2thbWktZGVtb3Mvbm9kZV9tb2R1bGVzL2thbWkvbGliL2dsdXRpbHMvTWVzaC5qcyIsIi9wcm9qZWN0cy9ucG11dGlscy9rYW1pLWRlbW9zL25vZGVfbW9kdWxlcy9rYW1pL2xpYi9nbHV0aWxzL1NoYWRlclByb2dyYW0uanMiLCIvcHJvamVjdHMvbnBtdXRpbHMva2FtaS1kZW1vcy9ub2RlX21vZHVsZXMva2FtaS9saWIvaW5kZXguanMiLCIvcHJvamVjdHMvbnBtdXRpbHMva2FtaS1kZW1vcy9ub2RlX21vZHVsZXMva2FtaS9ub2RlX21vZHVsZXMvbnVtYmVyLXV0aWwvaW5kZXguanMiLCIvcHJvamVjdHMvbnBtdXRpbHMva2FtaS1kZW1vcy9ub2RlX21vZHVsZXMva2xhc3NlL2luZGV4LmpzIiwiL3Byb2plY3RzL25wbXV0aWxzL2thbWktZGVtb3Mvbm9kZV9tb2R1bGVzL3JhZi5qcy9yYWYuanMiLCIvcHJvamVjdHMvbnBtdXRpbHMva2FtaS1kZW1vcy9zcmMvYXNzZXRzL21haW4uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNuQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3YkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzZ0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JjQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaG1CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9RQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNoR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJzb3VyY2VzQ29udGVudCI6WyIvKiFcbiAgKiBkb21yZWFkeSAoYykgRHVzdGluIERpYXogMjAxMiAtIExpY2Vuc2UgTUlUXG4gICovXG4hZnVuY3Rpb24gKG5hbWUsIGRlZmluaXRpb24pIHtcbiAgaWYgKHR5cGVvZiBtb2R1bGUgIT0gJ3VuZGVmaW5lZCcpIG1vZHVsZS5leHBvcnRzID0gZGVmaW5pdGlvbigpXG4gIGVsc2UgaWYgKHR5cGVvZiBkZWZpbmUgPT0gJ2Z1bmN0aW9uJyAmJiB0eXBlb2YgZGVmaW5lLmFtZCA9PSAnb2JqZWN0JykgZGVmaW5lKGRlZmluaXRpb24pXG4gIGVsc2UgdGhpc1tuYW1lXSA9IGRlZmluaXRpb24oKVxufSgnZG9tcmVhZHknLCBmdW5jdGlvbiAocmVhZHkpIHtcblxuICB2YXIgZm5zID0gW10sIGZuLCBmID0gZmFsc2VcbiAgICAsIGRvYyA9IGRvY3VtZW50XG4gICAgLCB0ZXN0RWwgPSBkb2MuZG9jdW1lbnRFbGVtZW50XG4gICAgLCBoYWNrID0gdGVzdEVsLmRvU2Nyb2xsXG4gICAgLCBkb21Db250ZW50TG9hZGVkID0gJ0RPTUNvbnRlbnRMb2FkZWQnXG4gICAgLCBhZGRFdmVudExpc3RlbmVyID0gJ2FkZEV2ZW50TGlzdGVuZXInXG4gICAgLCBvbnJlYWR5c3RhdGVjaGFuZ2UgPSAnb25yZWFkeXN0YXRlY2hhbmdlJ1xuICAgICwgcmVhZHlTdGF0ZSA9ICdyZWFkeVN0YXRlJ1xuICAgICwgbG9hZGVkUmd4ID0gaGFjayA/IC9ebG9hZGVkfF5jLyA6IC9ebG9hZGVkfGMvXG4gICAgLCBsb2FkZWQgPSBsb2FkZWRSZ3gudGVzdChkb2NbcmVhZHlTdGF0ZV0pXG5cbiAgZnVuY3Rpb24gZmx1c2goZikge1xuICAgIGxvYWRlZCA9IDFcbiAgICB3aGlsZSAoZiA9IGZucy5zaGlmdCgpKSBmKClcbiAgfVxuXG4gIGRvY1thZGRFdmVudExpc3RlbmVyXSAmJiBkb2NbYWRkRXZlbnRMaXN0ZW5lcl0oZG9tQ29udGVudExvYWRlZCwgZm4gPSBmdW5jdGlvbiAoKSB7XG4gICAgZG9jLnJlbW92ZUV2ZW50TGlzdGVuZXIoZG9tQ29udGVudExvYWRlZCwgZm4sIGYpXG4gICAgZmx1c2goKVxuICB9LCBmKVxuXG5cbiAgaGFjayAmJiBkb2MuYXR0YWNoRXZlbnQob25yZWFkeXN0YXRlY2hhbmdlLCBmbiA9IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAoL15jLy50ZXN0KGRvY1tyZWFkeVN0YXRlXSkpIHtcbiAgICAgIGRvYy5kZXRhY2hFdmVudChvbnJlYWR5c3RhdGVjaGFuZ2UsIGZuKVxuICAgICAgZmx1c2goKVxuICAgIH1cbiAgfSlcblxuICByZXR1cm4gKHJlYWR5ID0gaGFjayA/XG4gICAgZnVuY3Rpb24gKGZuKSB7XG4gICAgICBzZWxmICE9IHRvcCA/XG4gICAgICAgIGxvYWRlZCA/IGZuKCkgOiBmbnMucHVzaChmbikgOlxuICAgICAgICBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHRlc3RFbC5kb1Njcm9sbCgnbGVmdCcpXG4gICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7IHJlYWR5KGZuKSB9LCA1MClcbiAgICAgICAgICB9XG4gICAgICAgICAgZm4oKVxuICAgICAgICB9KClcbiAgICB9IDpcbiAgICBmdW5jdGlvbiAoZm4pIHtcbiAgICAgIGxvYWRlZCA/IGZuKCkgOiBmbnMucHVzaChmbilcbiAgICB9KVxufSlcbiIsIi8vVGhpcyBpcyBhbiBhc3NldCBsb2FkZXIgcXVldWUgdGFpbG9yZWQgZm9yIEthbWkvV2ViR0xcblxudmFyIExvYWRlckJhc2UgPSByZXF1aXJlKCdhc3NldGxvYWRlcicpO1xudmFyIENsYXNzID0gcmVxdWlyZSgna2xhc3NlJyk7XG52YXIgVGV4dHVyZSA9IHJlcXVpcmUoJ2thbWknKS5UZXh0dXJlO1xuXG4vL3RoaXMgaXMgYSBrYW1pLXNwZWNpZmljIGxvYWRlciBmb3IgYSBUZXh0dXJlIG9iamVjdFxuLy9pdCBpcyBhc3N1bWVkIHRoYXQgdGhlIEFzc2V0TWFuYWdlciBiZWluZyBwYXNzZWQgaXMgYSBXZWJHTENvbnRleHRcbmZ1bmN0aW9uIFRleHR1cmVMb2FkZXIobmFtZSwgcGF0aCwgdGV4dHVyZSwgZ2VuTWlwbWFwcykge1xuICAgIHBhdGggPSBwYXRoIHx8IG5hbWU7XG5cbiAgICB0ZXh0dXJlID0gdGV4dHVyZSB8fCBuZXcgVGV4dHVyZSh0aGlzLmNvbnRleHQpO1xuICAgIFxuICAgIHJldHVybiB7XG5cbiAgICAgICAgdmFsdWU6IHRleHR1cmUsXG5cbiAgICAgICAgbG9hZDogZnVuY3Rpb24ob25Db21wbGV0ZSwgb25FcnJvcikge1xuICAgICAgICAgICAgLy9UZXh0dXJlIGhhcyBhIGhhbmR5IGZ1bmN0aW9uIGZvciB0aGlzIHNvcnQgb2YgdGhpbmcuLi5cbiAgICAgICAgICAgIHRleHR1cmUuc2V0dXAocGF0aCwgb25Db21wbGV0ZSwgb25FcnJvciwgZ2VuTWlwbWFwcyk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbi8vU2V0dXAgbG9hZGVyIHBhcmFtZXRlcnNcblRleHR1cmVMb2FkZXIuZXh0ZW5zaW9ucyA9IFtcInBuZ1wiLCBcImdpZlwiLCBcImpwZ1wiLCBcImpwZWdcIl07XG5UZXh0dXJlTG9hZGVyLm1lZGlhVHlwZSA9IFwiaW1hZ2VcIjtcblxudmFyIEFzc2V0TG9hZGVyID0gbmV3IENsYXNzKHtcblxuICAgIEV4dGVuZHM6IExvYWRlckJhc2UsXG5cbiAgICBpbml0aWFsaXplOiBmdW5jdGlvbihjb250ZXh0KSB7XG4gICAgICAgIExvYWRlckJhc2UuY2FsbCh0aGlzKTtcblxuICAgICAgICBpZiAoIWNvbnRleHQgfHwgdHlwZW9mIGNvbnRleHQgIT09IFwib2JqZWN0XCIpXG4gICAgICAgICAgICB0aHJvdyBcIkthbWkgQXNzZXRMb2FkZXIgbXVzdCBiZSBwYXNzZWQgd2l0aCBhIHZhbGlkIFdlYkdMQ29udGV4dFwiO1xuXG4gICAgICAgIHRoaXMucmVnaXN0ZXJMb2FkZXIoVGV4dHVyZUxvYWRlcik7XG5cbiAgICAgICAgdGhpcy5jb250ZXh0ID0gY29udGV4dDtcbiAgICAgICAgdGhpcy5fX2ludmFsaWRhdGVGdW5jID0gdGhpcy5pbnZhbGlkYXRlLmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMuY29udGV4dC5yZXN0b3JlZC5hZGQoIHRoaXMuX19pbnZhbGlkYXRlRnVuYyApO1xuICAgIH0sXG5cbiAgICBkZXN0cm95OiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5jb250ZXh0LnJlc3RvcmVkLnJlbW92ZSh0aGlzLl9faW52YWxpZGF0ZUZ1bmMpO1xuICAgIH1cbn0pO1xuXG4vL0NvcHkgc3RhdGljIGF0dHJpYnV0ZXMgLi4uXG5Bc3NldExvYWRlci5TdGF0dXMgPSBMb2FkZXJCYXNlLlN0YXR1cztcblxuQXNzZXRMb2FkZXIucmVnaXN0ZXJDb21tb25Mb2FkZXIgPSBMb2FkZXJCYXNlLnJlZ2lzdGVyQ29tbW9uTG9hZGVyO1xuXG5Bc3NldExvYWRlci5EZXNjcmlwdG9yID0gTG9hZGVyQmFzZS5EZXNjcmlwdG9yO1xuXG5Bc3NldExvYWRlci5UZXh0dXJlTG9hZGVyID0gVGV4dHVyZUxvYWRlcjtcblxubW9kdWxlLmV4cG9ydHMgPSBBc3NldExvYWRlcjtcblxuXG5cblxuXG5cblxuXG4vLy8gb2xkIGRvY3MuIFxuXG4gICAgLyoqXG4gICAgICogVGhpcyBpcyB0aGUgbG9hZGluZyBmdW5jdGlvbiBvZiBhIEFzc2V0TWFuYWdlciBwbHVnaW4sIFxuICAgICAqIHdoaWNoIGhhbmRsZXMgdGhlIGFzeW5jaHJvbm91cyBsb2FkaW5nIGZvciBhbiBhc3NldC4gXG4gICAgICogVGhlIGZ1bmN0aW9uIG11c3QgYmUgaW1wbGVtZW50ZWQgaW4gYSB2ZXJ5XG4gICAgICogc3RyaWN0IG1hbm5lciBmb3IgdGhlIGFzc2V0IG1hbmFnZXIgdG8gd29yayBjb3JyZWN0bHkuXG4gICAgICpcbiAgICAgKiBPbmNlIHRoZSBhc3luYyBsb2FkaW5nIGlzIGRvbmUsIHlvdSBtdXN0IGNhbGwgdGhlIGBmaW5pc2hlZGAgY2FsbGJhY2tcbiAgICAgKiB0aGF0IHdhcyBwYXNzZWQgdG8gdGhpcyBtZXRob2QuIFlvdSBjYW4gcGFzcyB0aGUgcGFyYW1ldGVyIGBmYWxzZWAgdG8gdGhlXG4gICAgICogZmluaXNoZWQgY2FsbGJhY2sgdG8gaW5kaWNhdGUgdGhlIGFzeW5jIGxvYWQgaGFzIGZhaWxlZC4gT3RoZXJ3aXNlLCBpdCBpcyBhc3N1bWVkXG4gICAgICogdG8gYmUgc3VjY2Vzc2Z1bC5cbiAgICAgKiBcbiAgICAgKiBJZiB5b3UgZG9uJ3QgaW52b2tlIHRoZSBjYWxsYmFjaywgdGhlIGFzc2V0IG1hbmFnZXIgbWF5IG5ldmVyIGZpbmlzaCBsb2FkaW5nLlxuICAgICAqIFxuICAgICAqIEBwYXJhbSAge1N0cmluZ30gbmFtZSB0aGUgbmFtZSBvZiB0aGUgYXNzZXQgdG8gbG9hZFxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGZpbmlzaGVkIHRoZSBmdW5jdGlvbiB0byBjYWxsIHdoZW4gYXN5bmMgbG9hZGluZyBpcyBjb21wbGV0ZVxuICAgICAqIEBwYXJhbSB7VGV4dHVyZX0gdGV4dHVyZSB0aGUgdGV4dHVyZSB0byBvcGVyYXRlIG9uIGZvciB0aGlzIGFzc2V0XG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHBhdGggdGhlIG9wdGlvbmFsIGltYWdlIHBhdGggdG8gdXNlIGluc3RlYWQgb2YgdGhlIGBuYW1lYCBwYXJhbWV0ZXJcbiAgICAgKi9cbi8qKlxuICogVGhpcyBpcyB0aGUgZGVmYXVsdCBpbXBsZW1lbnRhdGlvbiBvZiBhbiBpbWFnZSBsb2FkZXIgcGx1Z2luIGZvciBBc3NldE1hbmFnZXIuXG4gKiBUaGlzIHVzZXMgYSBET00gSW1hZ2Ugb2JqZWN0IHRvIHVwbG9hZCBQTkcsIEdJRiBhbmQgSlBHIGltYWdlcyB0byBhIFdlYkdMXG4gKiB0ZXh0dXJlLiBZb3Ugd2lsbCBub3QgbmVlZCB0byBkZWFsIHdpdGggdGhpcyBjbGFzcyBkaXJlY3RseSwgdW5sZXNzIHlvdSB3YW50XG4gKiB0byB3cml0ZSB5b3VyIG93biBBc3NldE1hbmFnZXIgbG9hZGVycy5cbiAqXG4gKiBBIExvYWRlciBwbHVnaW4gaXMgYSBjbGFzcyB3aGljaCBoYW5kbGVzIHRoZSBhc3luY2hyb25vdXMgbG9hZGluZyBhbmQgcHJvdmlkZXNcbiAqIGEgY29udmVuaWVudCByZXR1cm4gdmFsdWUgZm9yIHRoZSBgQXNzZXRNYW5hZ2VyLmxvYWQoKWAgZnVuY3Rpb25zLiBUaGUgbG9hZGVyIGNsYXNzXG4gKiBpcyBjb25zdHJ1Y3RlZCB3aXRoIHRoZSBmb2xsb3dpbmcgcGFyYW1ldGVyczogZmlyc3QsIHRoZSBXZWJHTENvbnRleHQgdGhpcyBBc3NldE1hbmFnZXJcbiAqIGlzIHVzaW5nLCBhbmQgc2Vjb25kLCB0aGUgbmFtZSBvZiB0aGUgYXNzZXQgdG8gYmUgbG9hZGVkLiBUaGUgc3Vic2VxdWVudCBhcmd1bWVudHMgYXJlXG4gKiB0aG9zZSB0aGF0IHdlcmUgcGFzc2VkIGFzIGV4dHJhIHRvIHRoZSBgQXNzZXRNYW5hZ2VyLmxvYWQoKWAgZnVuY3Rpb25zLlxuICpcbiAqIEEgbG9hZGVyIG11c3QgaW1wbGVtZW50IGEgYGxvYWQoKWAgZnVuY3Rpb24sIGFuZCBpdCdzIGVuY291cmFnZWQgdG8gYWxzbyBpbXBsZW1lbnQgYSBcbiAqIGBnZXRSZXR1cm5WYWx1ZSgpYCBmdW5jdGlvbiwgZm9yIGNvbnZlbmllbmNlLlxuICogXG4gKiBAcGFyYW0ge1dlYkdMQ29udGV4dH0gY29udGV4dCB0aGUgY29udGV4dCwgcGFzc2VkIGJ5IEFzc2V0TWFuYWdlclxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgdGhlIHVuaXF1ZSBrZXkgZm9yIHRoaXMgYXNzZXRcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIHRoZSBvcHRpb25hbCBwYXRoIG9yIGRhdGEgVVJJIHRvIHVzZSwgd2lsbCBkZWZhdWx0IHRvIHRoZSBuYW1lIHBhcmFtXG4gKiBAcGFyYW0ge1RleHR1cmV9IHRleHR1cmUgYW4gb3B0aW9uYWwgdGV4dHVyZSB0byBhY3Qgb247IGlmIHVuZGVmaW5lZCwgYSBuZXcgdGV4dHVyZVxuICogICAgICAgICAgICAgICAgICAgICAgICAgIHdpbGwgYmUgY3JlYXRlZFxuICovIiwiLy90aGlzIGlzIGEgZ2VuZXJpYyBsb2FkZXIgZm9yIEltYWdlIG9iamVjdHNcbi8vZS5nLiB3aXRoIEhUTUwgb3IgMkQgQ2FudmFzXG5mdW5jdGlvbiBJbWFnZUxvYWRlcihuYW1lLCBwYXRoKSB7XG5cdHBhdGggPSBwYXRoIHx8IG5hbWU7XG5cdHZhciBpbWcgPSBuZXcgSW1hZ2UoKTtcblxuXHRyZXR1cm4ge1xuXHRcdFxuXHRcdHZhbHVlOiBpbWcsXG5cblx0XHRsb2FkOiBmdW5jdGlvbihvbkNvbXBsZXRlLCBvbkVycm9yKSB7XG5cdFx0XHRpbWcub25sb2FkID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGltZy5vbmVycm9yID0gaW1nLm9uYWJvcnQgPSBudWxsOyAvL2NsZWFyIG90aGVyIGxpc3RlbmVyc1xuXHRcdFx0XHRvbkNvbXBsZXRlKCk7XG5cdFx0XHR9O1xuXHRcdFx0aW1nLm9uZXJyb3IgPSBmdW5jdGlvbigpIHtcblx0XHRcdFx0aW1nLm9ubG9hZCA9IGltZy5vbmFib3J0ID0gbnVsbDtcblx0XHRcdFx0Y29uc29sZS53YXJuKFwiRXJyb3IgbG9hZGluZyBpbWFnZTogXCIrcGF0aCk7XG5cdFx0XHRcdG9uRXJyb3IoKTtcblx0XHRcdH07XG5cdFx0XHRpbWcub25hYm9ydCA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRpbWcub25sb2FkID0gaW1nLm9uZXJyb3IgPSBudWxsO1xuXHRcdFx0XHRjb25zb2xlLndhcm4oXCJBYm9ydGVkIGltYWdlOiBcIitwYXRoKTtcblx0XHRcdFx0b25FcnJvcigpO1xuXHRcdFx0fTtcblx0XHRcdC8vc2V0dXAgc291cmNlXG5cdFx0XHRcblx0XHRcdGltZy5zcmMgPSBwYXRoO1xuXHRcdH1cblx0fTtcbn1cblxuSW1hZ2VMb2FkZXIuZXh0ZW5zaW9ucyA9IFtcInBuZ1wiLCBcImdpZlwiLCBcImpwZ1wiLCBcImpwZWdcIl07XG5cbkltYWdlTG9hZGVyLm1lZGlhVHlwZSA9IFwiaW1hZ2VcIjtcblxubW9kdWxlLmV4cG9ydHMgPSBJbWFnZUxvYWRlcjsiLCJ2YXIgQ2xhc3MgPSByZXF1aXJlKCdrbGFzc2UnKTtcbnZhciBTaWduYWwgPSByZXF1aXJlKCdzaWduYWxzJyk7XG52YXIgSW1hZ2VMb2FkZXIgPSByZXF1aXJlKCcuL2V4dC9JbWFnZUxvYWRlcicpO1xuXG5mdW5jdGlvbiByZWdpc3RlckxvYWRlcihsb2FkZXJzLCBsb2FkZXJGdW5jLCBleHRlbnNpb25zLCBtZWRpYVR5cGUpIHtcblx0aWYgKCFsb2FkZXJGdW5jIHx8ICFleHRlbnNpb25zIHx8ICFleHRlbnNpb25zLmxlbmd0aClcblx0XHR0aHJvdyBcIm11c3Qgc3BlY2lmeSBhdCBsZWFzdCBvbmUgZXh0ZW5zaW9uIGZvciB0aGUgbG9hZGVyXCI7XG5cdFxuXHRmb3IgKHZhciBpPTA7IGk8ZXh0ZW5zaW9ucy5sZW5ndGg7IGkrKykge1xuXHRcdGxvYWRlcnNbIGV4dGVuc2lvbnNbaV0gXSA9IGxvYWRlckZ1bmM7XG5cdFx0aWYgKG1lZGlhVHlwZSkgXG5cdFx0XHRsb2FkZXJzWyBtZWRpYVR5cGUgKyAnLycgKyBleHRlbnNpb25zW2ldIF0gPSBsb2FkZXJGdW5jO1xuXHR9XG59XG5cbi8qKlxuICogVGhpcyBpcyBhIGJhc2UgY2xhc3MgZm9yIGFzc2V0IG1hbmFnZW1lbnQ7IGlkZWFsIGZvciBlaXRoZXJcbiAqIGdlbmVyaWMgSFRNTDUgMkQgY2FudmFzIG9yIFdlYkdMIGNhbnZhcy5cbiAqIFxuICogQGNsYXNzICBBc3NldExvYWRlclxuICogQGNvbnN0cnVjdG9yIFxuICovXG52YXIgQXNzZXRMb2FkZXIgPSBuZXcgQ2xhc3Moe1xuXHRcblx0LyoqXG5cdCAqIEEgcmVhZC1vbmx5IHByb3BlcnR5IHRoYXQgZGVzY3JpYmVzIHRoZSBudW1iZXIgb2YgXG5cdCAqIGFzc2V0cyByZW1haW5pbmcgdG8gYmUgbG9hZGVkLlxuXHQgKlxuXHQgKiBAcHJvcGVydHkgcmVtYWluaW5nXG5cdCAqIEB0eXBlIHtOdW1iZXJ9XG5cdCAqIEByZWFkT25seVxuXHQgKi9cblx0cmVtYWluaW5nOiB7XG5cdFx0Z2V0OiBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiB0aGlzLl9fbG9hZENvdW50O1xuXHRcdH1cblx0fSxcblxuXHQvKipcblx0ICogQSByZWFkLW9ubHkgcHJvcGVydHkgdGhhdCBkZXNjcmlpYmVzIHRoZSB0b3RhbFxuXHQgKiBudW1iZXIgb2YgYXNzZXRzIGluIHRoaXMgQXNzZXRMb2FkZXIuXG5cdCAqIFxuXHQgKiBAcHJvcGVydHkgdG90YWxcblx0ICogQHJlYWRPbmx5XG5cdCAqIEB0eXBlIHtOdW1iZXJ9XG5cdCAqL1xuXHR0b3RhbDoge1xuXHRcdGdldDogZnVuY3Rpb24oKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fX3RvdGFsSXRlbXM7XG5cdFx0fVxuXHR9LFxuXG5cdC8qKlxuXHQgKiBBIGNvbnZlbmllbmNlIHJlYWQtb25seSBnZXR0ZXIgZm9yIHRoZSBjdXJyZW50IHByb2dyZXNzLFxuXHQgKiB3aGljaCBpcyB0aGUgc2FtZSBhcyB0b3RhbCAtIHJlbWFpbmluZy5cblx0ICogXG5cdCAqIEBwcm9wZXJ0eSBjdXJyZW50XG5cdCAqIEByZWFkT25seVxuXHQgKiBAdHlwZSB7TnVtYmVyfVxuXHQgKi9cblx0Y3VycmVudDoge1xuXHRcdGdldDogZnVuY3Rpb24oKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy50b3RhbCAtIHRoaXMucmVtYWluaW5nO1xuXHRcdH1cblx0fSxcblxuXHQvL0NvbnN0cnVjdG9yXG5cdGluaXRpYWxpemU6IGZ1bmN0aW9uIEFzc2V0TG9hZGVyKCkge1xuXG5cdFx0LyoqXG5cdFx0ICogQW4gYXJyYXkgb2YgRGVzY3JpcHRvcnMgdGhhdCB0aGlzIHF1ZXVlIGlzIGhhbmRsaW5nLlxuXHRcdCAqIFRoaXMgc2hvdWxkIG5vdCBiZSBtb2RpZmllZCBkaXJlY3RseS5cblx0XHQgKiBcblx0XHQgKiBAcHJvcGVydHkgYXNzZXRzXG5cdFx0ICogQHR5cGUge0FycmF5fVxuXHRcdCAqL1xuXHRcdHRoaXMuYXNzZXRzID0gW107XG5cblx0XHQvKipcblx0XHQgKiBUaGUgcXVldWUgb2YgdGFza3MgdG8gbG9hZC4gRWFjaCBjb250YWluc1xuXHRcdCAqIGFuXG5cdFx0ICoge3sjY3Jvc3NMaW5rIFwiQXNzZXRMb2FkZXIuRGVzY3JpcHRvclwifX17ey9jcm9zc0xpbmt9fS5cblx0XHQgKlxuXHRcdCAqIExvYWRpbmcgYSB0YXNrIHdpbGwgcG9wIGl0IG9mZiB0aGlzIGxpc3QgYW5kIGZpcmUgdGhlIGFzeW5jXG5cdFx0ICogb3Igc3luY2hyb25vdXMgcHJvY2Vzcy5cblx0XHQgKlxuXHRcdCAqIFRoaXMgc2hvdWxkIG5vdCBiZSBtb2RpZmllZCBkaXJlY3RseS5cblx0XHQgKlxuXHRcdCAqIEBwcm9wZXJ0eSB0YXNrc1xuXHRcdCAqIEBwcm90ZWN0ZWRcblx0XHQgKiBAdHlwZSB7QXJyYXl9XG5cdFx0ICovXG5cdFx0dGhpcy50YXNrcyA9IFtdO1xuXG5cdFx0Ly9Qcml2YXRlIHN0dWZmLi4uIGRvIG5vdCB0b3VjaCFcblxuXHRcdHRoaXMuX19sb2FkQ291bnQgPSAwO1xuXHRcdHRoaXMuX190b3RhbEl0ZW1zID0gMDtcblxuXHRcdC8vIFNpZ25hbHMgXG5cdFx0XG5cdFx0LyoqXG5cdFx0ICogQSBzaWduYWwgZGlzcGF0Y2hlZCB3aGVuIGxvYWRpbmcgZmlyc3QgYmVnaW5zLCBcblx0XHQgKiBpLmUuIHdoZW4gdXBkYXRlKCkgaXMgY2FsbGVkIGFuZCB0aGUgbG9hZGluZyBxdWV1ZSBpcyB0aGVcblx0XHQgKiBzYW1lIHNpemUgYXMgdGhlIHRvdGFsIGFzc2V0IGxpc3QuXG5cdFx0ICpcblx0XHQgKiBAZXZlbnQgbG9hZFN0YXJ0ZWRcblx0XHQgKiBAdHlwZSB7U2lnbmFsfVxuXHRcdCAqL1xuXHRcdHRoaXMubG9hZFN0YXJ0ZWQgPSBuZXcgU2lnbmFsKCk7XG5cblx0XHQvKipcblx0XHQgKiBBIHNpZ25hbCBkaXNwYXRjaGVkIHdoZW4gYWxsIGFzc2V0cyBoYXZlIGJlZW4gbG9hZGVkXG5cdFx0ICogKGkuZS4gdGhlaXIgYXN5bmMgdGFza3MgZmluaXNoZWQpLlxuXHRcdCAqXG5cdFx0ICogQGV2ZW50IGxvYWRGaW5pc2hlZFxuXHRcdCAqIEB0eXBlIHtTaWduYWx9XG5cdFx0ICovXG5cdFx0dGhpcy5sb2FkRmluaXNoZWQgPSBuZXcgU2lnbmFsKCk7XG5cblx0XHQvKipcblx0XHQgKiBBIHNpZ25hbCBkaXNwYXRjaGVkIG9uIHByb2dyZXNzIHVwZGF0ZXMsIG9uY2UgYW4gYXNzZXRcblx0XHQgKiBoYXMgYmVlbiBsb2FkZWQgaW4gZnVsbCAoaS5lLiBpdHMgYXN5bmMgdGFzayBmaW5pc2hlZCkuXG5cdFx0ICpcblx0XHQgKiBUaGlzIHBhc3NlcyBhbiBldmVudCBvYmplY3QgdG8gdGhlIGxpc3RlbmVyIGZ1bmN0aW9uXG5cdFx0ICogd2l0aCB0aGUgZm9sbG93aW5nIHByb3BlcnRpZXM6XG5cdFx0ICogXG5cdFx0ICogLSBgY3VycmVudGAgbnVtYmVyIG9mIGFzc2V0cyB0aGF0IGhhdmUgYmVlbiBsb2FkZWRcblx0XHQgKiAtIGB0b3RhbGAgbnVtYmVyIG9mIGFzc2V0cyB0byBsb2FkZWRcblx0XHQgKiAtIGBuYW1lYCBvZiB0aGUgYXNzZXQgd2hpY2ggd2FzIGp1c3QgbG9hZGVkXG5cdFx0ICogIFxuXHRcdCAqIEBldmVudCBsb2FkUHJvZ3Jlc3Ncblx0XHQgKiBAdHlwZSB7W3R5cGVdfVxuXHRcdCAqL1xuXHRcdHRoaXMubG9hZFByb2dyZXNzID0gbmV3IFNpZ25hbCgpO1xuXG5cdFx0LyoqXG5cdFx0ICogQSBzaWduYWwgZGlzcGF0Y2hlZCBvbiBwcm9ibGVtYXRpYyBsb2FkOyBlLmcuIGlmXG5cdFx0ICogdGhlIGltYWdlIHdhcyBub3QgZm91bmQgYW5kIFwib25lcnJvclwiIHdhcyB0cmlnZ2VyZWQuIFxuXHRcdCAqIFRoZSBmaXJzdCBhcmd1bWVudCBwYXNzZWQgdG8gdGhlIGxpc3RlbmVyIHdpbGwgYmUgXG5cdFx0ICogdGhlIHN0cmluZyBuYW1lIG9mIHRoZSBhc3NldC5cblx0XHQgKlxuXHRcdCAqIFRoZSBhc3NldCBtYW5hZ2VyIHdpbGwgY29udGludWUgbG9hZGluZyBzdWJzZXF1ZW50IGFzc2V0cy5cblx0XHQgKlxuXHRcdCAqIFRoaXMgaXMgZGlzcGF0Y2hlZCBhZnRlciB0aGUgc3RhdHVzIG9mIHRoZSBhc3NldCBpc1xuXHRcdCAqIHNldCB0byBTdGF0dXMuTE9BRF9GQUlMLCBhbmQgYmVmb3JlIHRoZSBsb2FkUHJvZ3Jlc3Ncblx0XHQgKiBzaWduYWwgaXMgZGlzcGF0Y2hlZC5cblx0XHQgKlxuXHRcdCAqIEBldmVudCBsb2FkRXJyb3Jcblx0XHQgKiBAdHlwZSB7U2lnbmFsfVxuXHRcdCAqL1xuXHRcdHRoaXMubG9hZEVycm9yID0gbmV3IFNpZ25hbCgpO1xuXG5cblx0XHQvKipcblx0XHQgKiBBIHNldCBvZiBsb2FkZXIgcGx1Z2lucyBmb3IgdGhpcyBhc3NldCBtYW5hZ2VyLiBUaGVzZSBtaWdodCBiZSBhcyBzaW1wbGVcblx0XHQgKiBhcyBwdXNoaW5nIEhUTUwgSW1hZ2Ugb2JqZWN0cyBpbnRvIGEgVGV4dHVyZSwgb3IgbW9yZSBjb21wbGV4IGxpa2UgZGVjb2Rpbmdcblx0XHQgKiBhIGNvbXByZXNzZWQsIG1pcC1tYXBwZWQsIG9yIGN1YmUtbWFwIHRleHR1cmUuXG5cdFx0ICpcblx0XHQgKiBUaGlzIG9iamVjdCBpcyBhIHNpbXBsZSBoYXNobWFwIG9mIGxvd2VyLWNhc2UgZXh0ZW5zaW9uIG5hbWVzIHRvIExvYWRlciBmdW5jdGlvbnMsXG5cdFx0ICogYW5kIG1pbWUtdHlwZXMgbGlrZSBcImltYWdlL3BuZ1wiIGZvciBkYXRhIFVSSXMuXG5cdFx0ICogXG5cdFx0ICogQHByb3BlcnR5IGxvYWRlcnNcblx0XHQgKiBAdHlwZSB7T2JqZWN0fVxuXHRcdCAqL1xuXHRcdHRoaXMubG9hZGVycyA9IHt9O1xuXG5cdFx0Ly9jb3B5IGZyb20gb3VyIGNvbW1vbiBsb2FkZXJzXG5cdFx0Zm9yICh2YXIgayBpbiBBc3NldExvYWRlci5jb21tb25Mb2FkZXJzKSB7XG5cdFx0XHRpZiAoQXNzZXRMb2FkZXIuY29tbW9uTG9hZGVycy5oYXNPd25Qcm9wZXJ0eShrKSkge1xuXHRcdFx0XHR0aGlzLmxvYWRlcnNba10gPSBBc3NldExvYWRlci5jb21tb25Mb2FkZXJzW2tdO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vV2UgcmVnaXN0ZXIgdGhlIGltYWdlIGxvYWRlciBieSBkZWZhdWx0XG5cdFx0dGhpcy5yZWdpc3RlckxvYWRlcihJbWFnZUxvYWRlcik7XG5cdH0sXG5cblx0LyoqXG5cdCAqIERlc3Ryb3lzIHRoaXMgYXNzZXQgbWFuYWdlcjsgZGVsZXRpbmcgdGhlIHRhc2tzXG5cdCAqIGFuZCBhc3NldHMgYXJyYXlzIGFuZCByZXNldHRpbmcgdGhlIGxvYWQgY291bnQuXG5cdCAqIFxuXHQgKiBAbWV0aG9kICBkZXN0cm95XG5cdCAqL1xuXHRkZXN0cm95OiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLnJlbW92ZUFsbCgpO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBDYWxsZWQgdG8gaW52YWxpZGF0ZSB0aGUgYXNzZXQgbWFuYWdlclxuXHQgKiBhbmQgcmVxdWlyZSBhbGwgYXNzZXRzIHRvIGJlIHJlLWxvYWRlZC5cblx0ICogRm9yIGV4YW1wbGUsIGEgV2ViR0wgYXBwIHdpbGwgY2FsbCB0aGlzIGludGVybmFsbHlcblx0ICogb24gY29udGV4dCBsb3NzLlxuXHQgKlxuXHQgKiBAcHJvdGVjdGVkXG5cdCAqIEBtZXRob2QgaW52YWxpZGF0ZVxuXHQgKi9cblx0aW52YWxpZGF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0Ly9tYXJrIGFsbCBhcyBub3QgeWV0IGxvYWRlZFxuXHRcdGZvciAodmFyIGk9MDsgaTx0aGlzLmFzc2V0cy5sZW5ndGg7IGkrKykge1xuXHRcdFx0dGhpcy5hc3NldHNbaV0uc3RhdHVzID0gQXNzZXRMb2FkZXIuU3RhdHVzLlFVRVVFRDtcblx0XHR9XG5cdFx0XG5cdFx0Ly9jb3B5IG91ciBhc3NldHMgdG8gYSBxdWV1ZSB3aGljaCBjYW4gYmUgcG9wcGVkXG5cdFx0dGhpcy50YXNrcyA9IHRoaXMuYXNzZXRzLnNsaWNlKCk7XG5cblx0XHR0aGlzLl9fbG9hZENvdW50ID0gdGhpcy5fX3RvdGFsSXRlbXMgPSB0aGlzLnRhc2tzLmxlbmd0aDtcblx0fSxcblxuXHQvKipcblx0ICogQXR0ZW1wdHMgdG8gZXh0cmFjdCBhIG1pbWUtdHlwZSBmcm9tIHRoZSBnaXZlbiBkYXRhIFVSSS4gSXQgd2lsbFxuXHQgKiBkZWZhdWx0IHRvIFwidGV4dC9wbGFpblwiIGlmIHRoZSBzdHJpbmcgaXMgYSBkYXRhIFVSSSB3aXRoIG5vIHNwZWNpZmllZFxuXHQgKiBtaW1lLXR5cGUuIElmIHRoZSBzdHJpbmcgZG9lcyBub3QgYmVnaW4gd2l0aCBcImRhdGE6XCIsIHRoaXMgbWV0aG9kIFxuXHQgKiByZXR1cm5zIG51bGwuXG5cdCAqXG5cdCAqIEBtZXRob2QgIF9fZ2V0RGF0YVR5cGVcblx0ICogQHByaXZhdGVcblx0ICogQHBhcmFtICB7U3RyaW5nfSBzdHIgdGhlIGRhdGEgVVJJXG5cdCAqIEByZXR1cm4ge1N0cmluZ30gICAgIHRoZSBtaW1lIHR5cGVcblx0ICovXG5cdF9fZ2V0RGF0YVR5cGU6IGZ1bmN0aW9uKHN0cikge1xuXHRcdHZhciB0ZXN0ID0gXCJkYXRhOlwiO1xuXHRcdC8vc3RhcnRzIHdpdGggJ2RhdGE6J1xuXHRcdHZhciBzdGFydCA9IHN0ci5zbGljZSgwLCB0ZXN0Lmxlbmd0aCkudG9Mb3dlckNhc2UoKTtcblx0XHRpZiAoc3RhcnQgPT0gdGVzdCkge1xuXHRcdFx0dmFyIGRhdGEgPSBzdHIuc2xpY2UodGVzdC5sZW5ndGgpO1xuXHRcdFx0XG5cdFx0XHR2YXIgc2VwSWR4ID0gZGF0YS5pbmRleE9mKCcsJyk7XG5cdFx0XHRpZiAoc2VwSWR4ID09PSAtMSkgLy9tYWxmb3JtZWQgZGF0YSBVUkkgc2NoZW1lXG5cdFx0XHRcdHJldHVybiBudWxsO1xuXG5cdFx0XHQvL2UuZy4gXCJpbWFnZS9naWY7YmFzZTY0XCIgPT4gXCJpbWFnZS9naWZcIlxuXHRcdFx0dmFyIGluZm8gPSBkYXRhLnNsaWNlKDAsIHNlcElkeCkuc3BsaXQoJzsnKVswXTtcblxuXHRcdFx0Ly9XZSBtaWdodCBuZWVkIHRvIGhhbmRsZSBzb21lIHNwZWNpYWwgY2FzZXMgaGVyZS4uLlxuXHRcdFx0Ly9zdGFuZGFyZGl6ZSB0ZXh0L3BsYWluIHRvIFwidHh0XCIgZmlsZSBleHRlbnNpb25cblx0XHRcdGlmICghaW5mbyB8fCBpbmZvLnRvTG93ZXJDYXNlKCkgPT0gXCJ0ZXh0L3BsYWluXCIpXG5cdFx0XHRcdHJldHVybiBcInR4dFwiXG5cblx0XHRcdC8vVXNlciBzcGVjaWZpZWQgbWltZSB0eXBlLCB0cnkgc3BsaXR0aW5nIGl0IGJ5ICcvJ1xuXHRcdFx0cmV0dXJuIGluZm8uc3BsaXQoJy8nKS5wb3AoKS50b0xvd2VyQ2FzZSgpO1xuXHRcdH1cblx0XHRyZXR1cm4gbnVsbDtcblx0fSxcblxuXHRfX2V4dGVuc2lvbjogZnVuY3Rpb24oc3RyKSB7XG5cdFx0dmFyIGlkeCA9IHN0ci5sYXN0SW5kZXhPZignLicpO1xuXHRcdGlmIChpZHggPT09IC0xIHx8IGlkeCA9PT0gMCB8fCBpZHggPT09IHN0ci5sZW5ndGgtMSkgLy8gZG9lcyBub3QgaGF2ZSBhIGNsZWFyIGZpbGUgZXh0ZW5zaW9uXG5cdFx0XHRyZXR1cm4gXCJcIjtcblx0XHRyZXR1cm4gc3RyLnN1YnN0cmluZyhpZHgrMSkudG9Mb3dlckNhc2UoKTtcblx0fSxcblxuXHQvKipcblx0ICogUmV0dXJucyB0aGUgQXNzZXREZXNjcmlwdG9yIGJ5IG5hbWUsIG9yIG51bGwgaWYgbm90IGZvdW5kLlxuXHQgKiBcblx0ICogQG1ldGhvZCAgZ2V0RGVzY3JpcHRvclxuXHQgKiBAcHJvdGVjdGVkXG5cdCAqIEBwYXJhbSAge0Fzc2V0RGVzY3JpcHRvcn0gbmFtZSB0aGUgbmFtZSBvZiB0aGUgYXNzZXRcblx0ICogQHJldHVybiB7YW55fSAgICAgIHRoZSBhc3NldFxuXHQgKi9cblx0Z2V0RGVzY3JpcHRvcjogZnVuY3Rpb24obmFtZSkge1xuXHRcdHZhciBpZHggPSB0aGlzLmluZGV4T2YodGhpcy5hc3NldHMsIG5hbWUpO1xuXHRcdHJldHVybiBpZHggIT09IC0xID8gdGhpcy5hc3NldHNbaWR4XSA6IG51bGw7XG5cdH0sXG5cblx0Z2V0U3RhdHVzOiBmdW5jdGlvbihuYW1lKSB7XG5cdFx0dmFyIGQgPSB0aGlzLmdldERlc2NyaXB0b3IobmFtZSk7XG5cdFx0cmV0dXJuIGQgPyBkLnN0YXR1cyA6IG51bGw7XG5cdH0sXG5cdFxuXHRpc0xvYWRlZDogZnVuY3Rpb24obmFtZSkge1xuXHRcdHJldHVybiB0aGlzLmdldFN0YXR1cyhuYW1lKSA9PT0gQXNzZXRMb2FkZXIuU3RhdHVzLkxPQURfU1VDQ0VTUztcblx0fSxcblx0XG5cdC8qKlxuXHQgKiBSZXR1cm5zIHRoZSB2YWx1ZSBzdG9yZWQgZm9yIHRoaXMgYXNzZXQsIHN1Y2ggYXMgYW4gSW1hZ2Vcblx0ICogaWYgd2UgYXJlIHVzaW5nIGEgQ2FudmFzIGltYWdlIGxvYWRpbmcgcGx1Z2luLiBSZXR1cm5zIG51bGxcblx0ICogaWYgdGhlIGFzc2V0IHdhcyBub3QgZm91bmQuXG5cdCAqIFx0XG5cdCAqIEBwYXJhbSAge1N0cmluZ30gbmFtZSB0aGUgbmFtZSBvZiB0aGUgYXNzZXQgdG8gZ2V0XG5cdCAqIEByZXR1cm4ge2FueX0gICAgdGhlIGFzc2V0IGJ5IG5hbWVcblx0ICovXG5cdGdldDogZnVuY3Rpb24obmFtZSkge1xuXHRcdHZhciBkID0gdGhpcy5nZXREZXNjcmlwdG9yKG5hbWUpO1xuXHRcdHJldHVybiBkID8gZC52YWx1ZSA6IG51bGw7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFJlbW92ZXMgYSByZWZlcmVuY2UgdG8gdGhlIGdpdmVuIGFzc2V0LCBhbmQgcmV0dXJucyB0aGUgcmVtb3ZlZFxuXHQgKiBhc3NldC4gSWYgdGhlIGFzc2V0IGJ5IG5hbWUgd2FzIG5vdCBmb3VuZCwgbnVsbCBpcyByZXR1cm5lZC5cblx0ICpcblx0ICogVGhpcyB3aWxsIGFsc28gcmVtb3ZlIHRoZSBhc3NldCBmcm9tIHRoZSB0YXNrIGxpc3QuXG5cdCAqXG5cdCAqIE5vdGUgdGhhdCB0aGlzIHdpbGwgbm90IGRlc3Ryb3kgYW55IHJlc291cmNlcyB0aGF0IGFzc2V0IG1haW50YWluZWQ7XG5cdCAqIHNvIGl0IGlzIHRoZSB1c2VyJ3MgZHV0eSB0byBkbyBzbyBhZnRlciByZW1vdmluZyBpdCBmcm9tIHRoZSBxdWV1ZS5cblx0ICogXG5cdCAqIEBwYXJhbSAge1t0eXBlXX0gbmFtZSBbZGVzY3JpcHRpb25dXG5cdCAqIEByZXR1cm4ge1t0eXBlXX0gICAgICBbZGVzY3JpcHRpb25dXG5cdCAqL1xuXHRyZW1vdmU6IGZ1bmN0aW9uKG5hbWUpIHtcblx0XHR2YXIgYXNzZXRJZHggPSB0aGlzLmluZGV4T2YodGhpcy5hc3NldHMsIG5hbWUpO1xuXHRcdGlmIChhc3NldElkeCA9PT0gLTEpXG5cdFx0XHRyZXR1cm4gbnVsbDtcblxuXHRcdHZhciBhc3NldCA9IHRoaXMuYXNzZXRzW2Fzc2V0SWR4XTtcblx0XHR2YXIgc3RhdHVzID0gYXNzZXQuc3RhdHVzO1xuXG5cdFx0Ly9sZXQncyBzZWUuLiB0aGUgYXNzZXQgY2FuIGVpdGhlciBiZSBRVUVVRURcblx0XHQvL29yIExPQURJTkcsIG9yIExPQURFRCAoZmFpbC9zdWNjZXNzKS4gaWYgaXQncyBxdWV1ZWQgXG5cblx0XHRcblx0XHQvL3JlbW92ZSByZWZlcmVuY2UgdG8gdGhlIGFzc2V0XG5cdFx0dGhpcy5hc3NldHMuc3BsaWNlKGFzc2V0SWR4LCAxKTtcblx0XHRcblx0XHQvL21ha2Ugc3VyZSBpdCdzIG5vdCBpbiBvdXIgdGFzayBsaXN0XG5cdFx0dmFyIHRhc2tJZHggPSB0aGlzLmluZGV4T2YodGhpcy50YXNrcywgbmFtZSk7XG5cblx0XHR0aGlzLl9fdG90YWxJdGVtcyA9IE1hdGgubWF4KDAsIHRoaXMuX190b3RhbEl0ZW1zLTEpO1xuXHRcdHRoaXMuX19sb2FkQ291bnQgPSBNYXRoLm1heCgwLCB0aGlzLl9fbG9hZENvdW50LTEpO1xuXHRcdGlmICh0YXNrSWR4ICE9PSAtMSkge1xuXHRcdFx0Ly9pdCdzIHdhaXRpbmcgdG8gYmUgbG9hZGVkLi4uIHdlIG5lZWQgdG8gcmVtb3ZlIGl0XG5cdFx0XHQvL2FuZCBhbHNvIGRlY3JlbWVudCB0aGUgbG9hZCAvIHRvdGFsIGNvdW50XG5cdFx0XHR0aGlzLnRhc2tzLnNwbGljZSh0YXNrSWR4LCAxKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly9ub3QgaW4gdGFza3MuLi4gYWxyZWFkeSBxdWV1ZWRcblx0XHRcdFxuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9fbG9hZENvdW50ID09PSAwKSB7XG5cdFx0XHRpZiAodGhpcy5sb2FkaW5nKSB7XG5cdFx0XHRcdHRoaXMubG9hZEZpbmlzaGVkLmRpc3BhdGNoKHtcblx0XHRcdFx0XHRjdXJyZW50OiAwLFxuXHRcdFx0XHRcdHRvdGFsOiAwXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5sb2FkaW5nID0gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiBhc3NldC52YWx1ZTtcblx0fSxcblxuXHRyZW1vdmVBbGw6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMuYXNzZXRzLmxlbmd0aCA9IDA7XG5cdFx0dGhpcy50YXNrcy5sZW5ndGggPSAwO1xuXHRcdHRoaXMuX19sb2FkQ291bnQgPSB0aGlzLl9fdG90YWxJdGVtcyA9IDA7XG5cblx0XHRpZiAodGhpcy5sb2FkaW5nKSB7XG5cdFx0XHR0aGlzLmxvYWRGaW5pc2hlZC5kaXNwYXRjaCh7XG5cdFx0XHRcdGN1cnJlbnQ6IDAsXG5cdFx0XHRcdHRvdGFsOiAwXG5cdFx0XHR9KTtcblx0XHR9XG5cdFx0dGhpcy5sb2FkaW5nID0gZmFsc2U7XG5cdH0sXG5cblx0LyoqXG5cdCAqIENhbGxzIGBhZGQoKWAgZm9yIGVhY2ggc3RyaW5nIGluIHRoZSBnaXZlbiBhcnJheS5cblx0ICpcblx0ICogQG1ldGhvZCBhZGRBbGxcblx0ICogQHBhcmFtICB7QXJyYXl9IGFycmF5IFxuXHQgKi9cblx0YWRkQWxsOiBmdW5jdGlvbihhcnJheSkge1xuXHRcdGZvciAodmFyIGk9MDsgaTxhcnJheS5sZW5ndGg7IGkrKykge1xuXHRcdFx0dGhpcy5hZGQoYXJyYXlbaV0pO1xuXHRcdH1cblx0fSxcblxuXHQvKipcblx0ICogUHVzaGVzIGFuIGFzc2V0IG9udG8gdGhpcyBzdGFjay4gVGhpc1xuXHQgKiBhdHRlbXB0cyB0byBkZXRlY3QgdGhlIGxvYWRlciBmb3IgeW91IGJhc2VkXG5cdCAqIG9uIHRoZSBhc3NldCBuYW1lJ3MgZmlsZSBleHRlbnNpb24gKG9yIGRhdGEgVVJJIHNjaGVtZSkuIFxuXHQgKiBJZiB0aGUgYXNzZXQgbmFtZSBkb2Vzbid0IGhhdmUgYSBrbm93biBmaWxlIGV4dGVuc2lvbixcblx0ICogb3IgaWYgdGhlcmUgaXMgbm8gbG9hZGVyIHJlZ2lzdGVyZWQgZm9yIHRoYXQgZmlsZW5hbWUsXG5cdCAqIHRoaXMgbWV0aG9kIHRocm93cyBhbiBlcnJvci4gSWYgeW91J3JlIHRyeWluZyB0byB1c2UgXG5cdCAqIGdlbmVyaWMga2V5cyBmb3IgYXNzZXQgbmFtZXMsIHVzZSB0aGUgYWRkQXMgbWV0aG9kIGFuZFxuXHQgKiBzcGVjaWZ5IGEgbG9hZGVyIHBsdWdpbi5cblx0ICogXG5cdCAqIFRoaXMgbWV0aG9kJ3MgYXJndW1lbnRzIGFyZSBwYXNzZWQgdG8gdGhlIGNvbnN0cnVjdG9yXG5cdCAqIG9mIHRoZSBsb2FkZXIgZnVuY3Rpb24uIFxuXHQgKlxuXHQgKiBUaGUgcmV0dXJuIHZhbHVlIG9mIHRoaXMgbWV0aG9kIGlzIGRldGVybWluZWQgYnlcblx0ICogdGhlIGxvYWRlcidzIHByb2Nlc3NBcmd1bWVudHMgbWV0aG9kLiBGb3IgZXhhbXBsZSwgdGhlXG5cdCAqIGRlZmF1bHQgSW1hZ2UgbG9hZGVyIHJldHVybnMgYSBUZXh0dXJlIG9iamVjdC5cblx0ICpcblx0ICogQGV4YW1wbGVcblx0ICogICAgLy91c2VzIEltYWdlTG9hZGVyIHRvIGdldCBhIG5ldyBUZXh0dXJlXG5cdCAqICAgIHZhciB0ZXggPSBhc3NldHMuYWRkKFwidGV4MC5wbmdcIik7IFxuXHQgKlxuXHQgKiAgICAvL29yIHlvdSBjYW4gc3BlY2lmeSB5b3VyIG93biB0ZXh0dXJlXG5cdCAqICAgIGFzc2V0cy5hZGQoXCJ0ZXgxLnBuZ1wiLCB0ZXgxKTtcblx0ICpcblx0ICogICAgLy90aGUgSW1hZ2VMb2FkZXIgYWxzbyBhY2NlcHRzIGEgcGF0aCBvdmVycmlkZSwgXG5cdCAqICAgIC8vYnV0IHRoZSBhc3NldCBrZXkgaXMgc3RpbGwgXCJmcmFtZXMwLnBuZ1wiXG5cdCAqICAgIGFzc2V0cy5hZGQoXCJmcmFtZTAucG5nXCIsIHRleDEsIFwicGF0aC90by9mcmFtZTEucG5nXCIpO1xuXHQgKiAgICBcblx0ICogQG1ldGhvZCAgYWRkXG5cdCAqIEBwYXJhbSAge1N0cmluZ30gbmFtZSB0aGUgYXNzZXQgbmFtZVxuXHQgKiBAcGFyYW0gIHthbnl9IGFyZ3MgYSB2YXJpYWJsZSBudW1iZXIgb2Ygb3B0aW9uYWwgYXJndW1lbnRzXG5cdCAqIEByZXR1cm4ge2FueX0gcmV0dXJucyB0aGUgYmVzdCB0eXBlIGZvciB0aGlzIGFzc2V0J3MgbG9hZGVyXG5cdCAqL1xuXHRhZGQ6IGZ1bmN0aW9uKG5hbWUpIHtcblx0XHRpZiAoIW5hbWUpXG5cdFx0XHR0aHJvdyBcIk5vIGFzc2V0IG5hbWUgc3BlY2lmaWVkIGZvciBhZGQoKVwiO1xuXG5cdFx0dmFyIGV4dCA9IHRoaXMuX19nZXREYXRhVHlwZShuYW1lKTtcblx0XHRpZiAoZXh0ID09PSBudWxsKVxuXHRcdFx0ZXh0ID0gdGhpcy5fX2V4dGVuc2lvbihuYW1lKTtcblxuXHRcdGlmICghZXh0KSBcblx0XHRcdHRocm93IFwiQXNzZXQgbmFtZSBkb2VzIG5vdCBoYXZlIGEgZmlsZSBleHRlbnNpb246IFwiICsgbmFtZTtcblx0XHRpZiAoIXRoaXMubG9hZGVycy5oYXNPd25Qcm9wZXJ0eShleHQpKVxuXHRcdFx0dGhyb3cgXCJObyBrbm93biBsb2FkZXIgZm9yIGV4dGVuc2lvbiBcIitleHQrXCIgaW4gYXNzZXQgXCIrbmFtZTtcblxuXHRcdHZhciBhcmdzID0gWyB0aGlzLmxvYWRlcnNbZXh0XSwgbmFtZSBdO1xuXHRcdGFyZ3MgPSBhcmdzLmNvbmNhdCggQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSApO1xuXG5cdFx0cmV0dXJuIHRoaXMuYWRkQXMuYXBwbHkodGhpcywgYXJncyk7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFB1c2hlcyBhbiBhc3NldCBvbnRvIHRoaXMgc3RhY2suIFRoaXMgYWxsb3dzIHlvdSB0b1xuXHQgKiBzcGVjaWZ5IGEgbG9hZGVyIGZ1bmN0aW9uIGZvciB0aGUgYXNzZXQuIFRoaXMgaXMgdXNlZnVsXG5cdCAqIGlmIHlvdSB3aXNoIHRvIHVzZSBnZW5lcmljIG5hbWVzIGZvciB5b3VyIGFzc2V0cyAoaW5zdGVhZCBvZlxuXHQgKiBmaWxlbmFtZXMpLCBvciBpZiB5b3Ugd2FudCBhIHBhcnRpY3VsYXIgYXNzZXQgdG8gdXNlIGEgc3BlY2lmaWNcblx0ICogbG9hZGVyLiBcblx0ICpcblx0ICogVGhlIGZpcnN0IGFyZ3VtZW50IGlzIHRoZSBsb2FkZXIgZnVuY3Rpb24sIGFuZCB0aGUgc2Vjb25kIGlzIHRoZSBhc3NldFxuXHQgKiBuYW1lLiBMaWtlIHdpdGgge3sjY3Jvc3NMaW5rIFwiQXNzZXRMb2FkZXIvbG9hZDptZXRob2RcIn19e3svY3Jvc3NMaW5rfX0sIFxuXHQgKiBhbnkgc3Vic2VxdWVudCBhcmd1bWVudHMgd2lsbCBiZSBwYXNzZWQgYWxvbmcgdG8gdGhlIGxvYWRlci5cblx0ICpcblx0ICogVGhlIHJldHVybiB2YWx1ZSBvZiB0aGlzIG1ldGhvZCBpcyBkZXRlcm1pbmVkIGJ5XG5cdCAqIHRoZSBsb2FkZXIncyByZXR1cm4gdmFsdWUsIGlmIGl0IGhhcyBvbmUuIEZvciBleGFtcGxlLCBhIENhbnZhcyBJbWFnZUxvYWRlclxuXHQgKiBwbHVnaW4gbWlnaHQgcmV0dXJubiBJbWFnZSBvYmplY3QuIFRoaXMgaXMgYWxzbyB0aGUgdmFsdWUgd2hpY2ggY2FuIGJlIHJldHJpZXZlZCB3aXRoXG5cdCAqIGBnZXQoKWAgb3IgYnkgYWNjZXNzaW5nIHRoZSBgdmFsdWVgIG9mIGFuIEFzc2V0RGVzY3JpcHRvci4gSWYgdGhlIGxvYWRlciBmdW5jdGlvblxuXHQgKiBkb2VzIG5vdCBpbXBsZW1lbnQgYSByZXR1cm4gdmFsdWUsIGB1bmRlZmluZWRgIGlzIHJldHVybmVkLiBcblx0ICpcblx0ICogQG1ldGhvZCAgYWRkQXNcblx0ICogQHBhcmFtIHtGdWNudGlvbn0gbG9hZGVyIHRoZSBsb2FkZXIgZnVuY3Rpb25cblx0ICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgdGhlIGFzc2V0IG5hbWVcblx0ICogQHBhcmFtIHtPYmplY3QgLi4ufSBhcmdzIGEgdmFyaWFibGUgbnVtYmVyIG9mIG9wdGlvbmFsIGFyZ3VtZW50c1xuXHQgKiBAcmV0dXJuIHthbnl9IHJldHVybnMgdGhlIGJlc3QgdHlwZSBmb3IgdGhpcyBhc3NldCdzIGxvYWRlclxuXHQgKi9cblx0YWRkQXM6IGZ1bmN0aW9uKGxvYWRlciwgbmFtZSkge1xuXHRcdGlmICghbmFtZSlcblx0XHRcdHRocm93IFwibm8gbmFtZSBzcGVjaWZpZWQgdG8gbG9hZFwiO1xuXHRcdGlmICghbG9hZGVyKVxuXHRcdFx0dGhyb3cgXCJubyBsb2FkZXIgc3BlY2lmaWVkIGZvciBhc3NldCBcIituYW1lO1xuXG5cdFx0dmFyIGlkeCA9IHRoaXMuaW5kZXhPZih0aGlzLmFzc2V0cywgbmFtZSk7XG5cdFx0aWYgKGlkeCAhPT0gLTEpIC8vVE9ETzogZXZlbnR1YWxseSBhZGQgc3VwcG9ydCBmb3IgZGVwZW5kZW5jaWVzIGFuZCBzaGFyZWQgYXNzZXRzXG5cdFx0XHR0aHJvdyBcImFzc2V0IGFscmVhZHkgZGVmaW5lZCBpbiBhc3NldCBtYW5hZ2VyXCI7XG5cblx0XHQvL2dyYWIgdGhlIGFyZ3VtZW50cywgZXhjZXB0IGZvciB0aGUgbG9hZGVyIGZ1bmN0aW9uLlxuXHRcdHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcblx0XHRcblx0XHQvL2NyZWF0ZSBvdXIgbG9hZGVyIGZ1bmN0aW9uIGFuZCBnZXQgdGhlIG5ldyByZXR1cm4gdmFsdWVcblx0XHR2YXIgcmV0T2JqID0gbG9hZGVyLmFwcGx5KHRoaXMsIGFyZ3MpO1xuXG5cdFx0aWYgKHR5cGVvZiByZXRPYmoubG9hZCAhPT0gXCJmdW5jdGlvblwiKVxuXHRcdFx0dGhyb3cgXCJsb2FkZXIgbm90IGltcGxlbWVudGVkIGNvcnJlY3RseTsgbXVzdCByZXR1cm4gYSAnbG9hZCcgZnVuY3Rpb25cIjtcblxuXHRcdC8va2VlcCBob2xkIG9mIHRoaXMgYXNzZXQgYW5kIGl0cyBvcmlnaW5hbCBuYW1lXG5cdFx0dmFyIGRlc2NyaXB0b3IgPSBuZXcgQXNzZXRMb2FkZXIuRGVzY3JpcHRvcihuYW1lLCByZXRPYmoubG9hZCwgcmV0T2JqLnZhbHVlKTtcblx0XHR0aGlzLmFzc2V0cy5wdXNoKCBkZXNjcmlwdG9yICk7XG5cblx0XHQvL2Fsc28gYWRkIGl0IHRvIG91ciBxdWV1ZSBvZiBjdXJyZW50IHRhc2tzXG5cdFx0dGhpcy50YXNrcy5wdXNoKCBkZXNjcmlwdG9yICk7XG5cdFx0dGhpcy5fX2xvYWRDb3VudCsrO1xuXHRcdHRoaXMuX190b3RhbEl0ZW1zKys7XG5cblx0XHRyZXR1cm4gcmV0T2JqLnZhbHVlO1xuXHR9LFxuXG5cdGluZGV4T2Y6IGZ1bmN0aW9uKGxpc3QsIG5hbWUpIHtcblx0XHRmb3IgKHZhciBpPTA7IGk8bGlzdC5sZW5ndGg7IGkrKykge1xuXHRcdFx0aWYgKGxpc3RbaV0gJiYgbGlzdFtpXS5uYW1lID09PSBuYW1lKVxuXHRcdFx0XHRyZXR1cm4gaTtcblx0XHR9XG5cdFx0cmV0dXJuIC0xO1xuXHR9LFxuXG5cblx0X19sb2FkQ2FsbGJhY2s6IGZ1bmN0aW9uKG5hbWUsIHN1Y2Nlc3MpIHtcblx0XHQvL2lmICdmYWxzZScgd2FzIHBhc3NlZCwgdXNlIGl0LlxuXHRcdC8vb3RoZXJ3aXNlIHRyZWF0IGFzICd0cnVlJ1xuXHRcdHN1Y2Nlc3MgPSBzdWNjZXNzICE9PSBmYWxzZTtcblxuXHRcdHZhciBhc3NldElkeCA9IHRoaXMuaW5kZXhPZih0aGlzLmFzc2V0cywgbmFtZSk7XG5cdFx0XHRcdFxuXHRcdC8vSWYgdGhlIGFzc2V0IGlzIG5vdCBmb3VuZCwgd2UgY2FuIGFzc3VtZSBpdFxuXHRcdC8vd2FzIHJlbW92ZWQgZnJvbSB0aGUgcXVldWUuIGluIHRoaXMgY2FzZSB3ZSBcblx0XHQvL3dhbnQgdG8gaWdub3JlIGV2ZW50cyBzaW5jZSB0aGV5IHNob3VsZCBhbHJlYWR5XG5cdFx0Ly9oYXZlIGJlZW4gZmlyZWQuXG5cdFx0aWYgKGFzc2V0SWR4ID09PSAtMSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRcblx0XHR0aGlzLl9fbG9hZENvdW50LS07XG5cblx0XHR0aGlzLmFzc2V0c1thc3NldElkeF0uc3RhdHVzID0gc3VjY2VzcyBcblx0XHRcdFx0XHRcdD8gQXNzZXRMb2FkZXIuU3RhdHVzLkxPQURfU1VDQ0VTU1xuXHRcdFx0XHRcdFx0OiBBc3NldExvYWRlci5TdGF0dXMuTE9BRF9GQUlMRUQ7XG5cblx0XHR2YXIgY3VycmVudCA9ICh0aGlzLl9fdG90YWxJdGVtcyAtIHRoaXMuX19sb2FkQ291bnQpLFxuXHRcdFx0dG90YWwgPSB0aGlzLl9fdG90YWxJdGVtcztcblxuXHRcdGlmICghc3VjY2Vzcykge1xuXHRcdFx0dGhpcy5sb2FkRXJyb3IuZGlzcGF0Y2goe1xuXHRcdFx0XHRuYW1lOiBuYW1lLFxuXHRcdFx0XHRjdXJyZW50OiBjdXJyZW50LFxuXHRcdFx0XHR0b3RhbDogdG90YWxcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHRoaXMubG9hZFByb2dyZXNzLmRpc3BhdGNoKHtcblx0XHRcdG5hbWU6IG5hbWUsXG5cdFx0XHRjdXJyZW50OiBjdXJyZW50LFxuXHRcdFx0dG90YWw6IHRvdGFsXG5cdFx0fSk7XG5cdFx0XHRcblx0XHRpZiAodGhpcy5fX2xvYWRDb3VudCA9PT0gMCkge1xuXHRcdFx0dGhpcy5sb2FkaW5nID0gZmFsc2U7XG5cdFx0XHR0aGlzLmxvYWRGaW5pc2hlZC5kaXNwYXRjaCh7XG5cdFx0XHRcdGN1cnJlbnQ6IGN1cnJlbnQsXG5cdFx0XHRcdHRvdGFsOiB0b3RhbFxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9LFxuXG5cdC8qKlxuXHQgKiBVcGRhdGVzIHRoaXMgQXNzZXRMb2FkZXIgYnkgbG9hZGluZyB0aGUgbmV4dCBhc3NldCBpbiB0aGUgcXVldWUuXG5cdCAqIElmIGFsbCBhc3NldHMgaGF2ZSBiZWVuIGxvYWRlZCwgdGhpcyBtZXRob2QgcmV0dXJucyB0cnVlLCBvdGhlcndpc2Vcblx0ICogaXQgd2lsbCByZXR1cm4gZmFsc2UuXG5cdCAqXG5cdCAqIEBtZXRob2QgIHVwZGF0ZVxuXHQgKiBAcmV0dXJuIHtCb29sZWFufSB3aGV0aGVyIHRoaXMgYXNzZXQgbWFuYWdlciBoYXMgZmluaXNoZWQgbG9hZGluZ1xuXHQgKi9cblx0dXBkYXRlOiBmdW5jdGlvbigpIHtcblx0XHRpZiAodGhpcy50YXNrcy5sZW5ndGggPT09IDApXG5cdFx0XHRyZXR1cm4gKHRoaXMuX19sb2FkQ291bnQgPT09IDApO1xuXG5cdFx0Ly9JZiB3ZSBzdGlsbCBoYXZlbid0IHBvcHBlZCBhbnkgZnJvbSB0aGUgYXNzZXRzIGxpc3QuLi5cblx0XHRpZiAodGhpcy50YXNrcy5sZW5ndGggPT09IHRoaXMuYXNzZXRzLmxlbmd0aCkge1xuXHRcdFx0dGhpcy5sb2FkaW5nID0gdHJ1ZTtcblx0XHRcdHRoaXMubG9hZFN0YXJ0ZWQuZGlzcGF0Y2goe1xuXHRcdFx0XHRjdXJyZW50OiAwLFxuXHRcdFx0XHR0b3RhbDogdGhpcy5fX3RvdGFsSXRlbXNcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdC8vZ3JhYiB0aGUgbmV4dCB0YXNrIG9uIHRoZSBzdGFja1xuXHRcdHZhciBuZXh0VGFzayA9IHRoaXMudGFza3Muc2hpZnQoKTtcblxuXHRcdC8vYXBwbHkgdGhlIGxvYWRpbmcgc3RlcFxuXHRcdHZhciBsb2FkZXIgPSBuZXh0VGFzay5sb2FkRnVuYztcblxuXHRcdHZhciBjYiA9IHRoaXMuX19sb2FkQ2FsbGJhY2suYmluZCh0aGlzLCBuZXh0VGFzay5uYW1lLCB0cnVlKTtcblx0XHR2YXIgY2JGYWlsID0gdGhpcy5fX2xvYWRDYWxsYmFjay5iaW5kKHRoaXMsIG5leHRUYXNrLm5hbWUsIGZhbHNlKTtcblxuXHRcdC8vZG8gdGhlIGFzeW5jIGxvYWQgLi4uXG5cdFx0bG9hZGVyLmNhbGwodGhpcywgY2IsIGNiRmFpbCk7XG5cblx0XHRyZXR1cm4gKHRoaXMuX19sb2FkQ291bnQgPT09IDApO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBSZWdpc3RlcnMgYSBsb2FkZXIgZnVuY3Rpb24gZm9yIHRoaXMgcXVldWUgd2l0aCB0aGUgZ2l2ZW4gZXh0ZW5zaW9uKHMpLlxuXHQgKiBUaGlzIHdpbGwgb3ZlcnJpZGUgYW55IGV4dGVuc2lvbnMgb3IgbWltZS10eXBlcyBhbHJlYWR5IHJlZ2lzdGVyZWQuXG5cdCAqIFxuXHQgKiBAbWV0aG9kIHJlZ2lzdGVyTG9hZGVyXG5cdCAqIEBwYXJhbSB7RnVuY3Rpb259IGxvYWRlciB0aGUgbG9hZGVyIGZ1bmN0aW9uXG5cdCAqL1xuXHRyZWdpc3RlckxvYWRlcjogZnVuY3Rpb24obG9hZGVyKSB7XG5cdFx0cmVnaXN0ZXJMb2FkZXIodGhpcy5sb2FkZXJzLCBsb2FkZXIsIGxvYWRlci5leHRlbnNpb25zLCBsb2FkZXIubWVkaWFUeXBlKTtcblx0fVxufSk7XG5cdFxuLyoqXG4gKiBUaGlzIGlzIGEgbWFwIG9mIFwiY29tbW9uXCIgbG9hZGVycywgc2hhcmVkIGJ5IG1hbnkgY29udGV4dHMuXG4gKiBGb3IgZXhhbXBsZSwgYW4gaW1hZ2UgbG9hZGVyIGlzIHNwZWNpZmljIHRvIFdlYkdMLCBDYW52YXMsIFNWRywgZXRjLFxuICogYnV0IGEgSlNPTiBsb2FkZXIgbWlnaHQgYmUgcmVuZGVyZXItaW5kZXBlbmRlbnQgYW5kIHRodXMgXCJjb21tb25cIi4gXG4gKlxuICogV2hlbiBhIG5ldyBBc3NldE1hbmFnZXIgaXMgY3JlYXRlZCwgaXQgd2lsbCB1c2UgdGhlc2UgbG9hZGVycy5cbiAqIFxuICogQHR5cGUge09iamVjdH1cbiAqL1xuQXNzZXRMb2FkZXIuY29tbW9uTG9hZGVycyA9IHt9O1xuXG4vKipcbiAqIFJlZ2lzdGVycyBhIFwiY29tbW9uXCIgbG9hZGVyIGZ1bmN0aW9uIHdpdGggdGhlIGdpdmVuIGV4dGVuc2lvbihzKS5cbiAqIFxuICogRm9yIGV4YW1wbGUsIGFuIGltYWdlIGxvYWRlciBpcyBzcGVjaWZpYyB0byBXZWJHTCwgQ2FudmFzLCBTVkcsIGV0YyxcbiAqIGJ1dCBhIEpTT04gbG9hZGVyIG1pZ2h0IGJlIHJlbmRlcmVyLWluZGVwZW5kZW50IGFuZCB0aHVzIFwiY29tbW9uXCIuIFxuICpcbiAqIFdoZW4gYSBuZXcgQXNzZXRNYW5hZ2VyIGlzIGNyZWF0ZWQsIGl0IHdpbGwgdXNlIHRoZXNlIGxvYWRlcnMuXG4gKiBcbiAqIEBtZXRob2QgcmVnaXN0ZXJDb21tb25Mb2FkZXJcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGxvYWRlciB0aGUgbG9hZGVyIGZ1bmN0aW9uXG4gKi9cbkFzc2V0TG9hZGVyLnJlZ2lzdGVyQ29tbW9uTG9hZGVyID0gZnVuY3Rpb24obG9hZGVyKSB7XG5cdHJlZ2lzdGVyTG9hZGVyKEFzc2V0TG9hZGVyLmNvbW1vbkxvYWRlcnMsIGxvYWRlciwgbG9hZGVyLmV4dGVuc2lvbnMsIGxvYWRlci5tZWRpYVR5cGUpO1xufVxuXG4vKipcbiAqIEEgc2ltcGxlIHdyYXBwZXIgZm9yIGFzc2V0cyB3aGljaCB3aWxsIGJlIHBhc3NlZCBhbG9uZyB0byB0aGUgbG9hZGVyO1xuICogdGhpcyBpcyB1c2VkIGludGVybmFsbHkuXG4gKiBcbiAqIC8vQGNsYXNzIEFzc2V0TG9hZGVyLkRlc2NyaXB0b3JcbiAqL1xuQXNzZXRMb2FkZXIuRGVzY3JpcHRvciA9IGZ1bmN0aW9uKG5hbWUsIGxvYWRGdW5jLCB2YWx1ZSkge1xuXHR0aGlzLm5hbWUgPSBuYW1lO1xuXHR0aGlzLmxvYWRGdW5jID0gbG9hZEZ1bmM7XG5cdHRoaXMudmFsdWUgPSB2YWx1ZTtcblx0dGhpcy5zdGF0dXMgPSBBc3NldExvYWRlci5TdGF0dXMuUVVFVUVEO1xufTtcblxuLyoqXG4gKiBEZWZpbmVzIHRoZSBzdGF0dXMgb2YgYW4gYXNzZXQgaW4gdGhlIG1hbmFnZXIgcXVldWUuXG4gKiBUaGUgY29uc3RhbnRzIHVuZGVyIHRoaXMgb2JqZWN0IGFyZSBvbmUgb2Y6XG4gKiBcbiAqICAgICBRVUVVRURcbiAqICAgICBMT0FESU5HXG4gKiAgICAgTE9BRF9TVUNDRVNTXG4gKiAgICAgTE9BRF9GQUlMXG4gKiBcbiAqIEBhdHRyaWJ1dGUgIFN0YXR1c1xuICogQHR5cGUge09iamVjdH1cbiAqL1xuQXNzZXRMb2FkZXIuU3RhdHVzID0ge1xuXHRRVUVVRUQ6IFwiUVVFVUVEXCIsXG5cdExPQURJTkc6IFwiTE9BRElOR1wiLFxuXHRMT0FEX1NVQ0NFU1M6IFwiTE9BRF9TVUNDRVNTXCIsXG5cdExPQURfRkFJTDogXCJMT0FEX0ZBSUxcIlxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBc3NldExvYWRlcjtcbiIsIi8qanNsaW50IG9uZXZhcjp0cnVlLCB1bmRlZjp0cnVlLCBuZXdjYXA6dHJ1ZSwgcmVnZXhwOnRydWUsIGJpdHdpc2U6dHJ1ZSwgbWF4ZXJyOjUwLCBpbmRlbnQ6NCwgd2hpdGU6ZmFsc2UsIG5vbWVuOmZhbHNlLCBwbHVzcGx1czpmYWxzZSAqL1xuLypnbG9iYWwgZGVmaW5lOmZhbHNlLCByZXF1aXJlOmZhbHNlLCBleHBvcnRzOmZhbHNlLCBtb2R1bGU6ZmFsc2UsIHNpZ25hbHM6ZmFsc2UgKi9cblxuLyoqIEBsaWNlbnNlXG4gKiBKUyBTaWduYWxzIDxodHRwOi8vbWlsbGVybWVkZWlyb3MuZ2l0aHViLmNvbS9qcy1zaWduYWxzLz5cbiAqIFJlbGVhc2VkIHVuZGVyIHRoZSBNSVQgbGljZW5zZVxuICogQXV0aG9yOiBNaWxsZXIgTWVkZWlyb3NcbiAqIFZlcnNpb246IDEuMC4wIC0gQnVpbGQ6IDI2OCAoMjAxMi8xMS8yOSAwNTo0OCBQTSlcbiAqL1xuXG4oZnVuY3Rpb24oZ2xvYmFsKXtcblxuICAgIC8vIFNpZ25hbEJpbmRpbmcgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgLyoqXG4gICAgICogT2JqZWN0IHRoYXQgcmVwcmVzZW50cyBhIGJpbmRpbmcgYmV0d2VlbiBhIFNpZ25hbCBhbmQgYSBsaXN0ZW5lciBmdW5jdGlvbi5cbiAgICAgKiA8YnIgLz4tIDxzdHJvbmc+VGhpcyBpcyBhbiBpbnRlcm5hbCBjb25zdHJ1Y3RvciBhbmQgc2hvdWxkbid0IGJlIGNhbGxlZCBieSByZWd1bGFyIHVzZXJzLjwvc3Ryb25nPlxuICAgICAqIDxiciAvPi0gaW5zcGlyZWQgYnkgSm9hIEViZXJ0IEFTMyBTaWduYWxCaW5kaW5nIGFuZCBSb2JlcnQgUGVubmVyJ3MgU2xvdCBjbGFzc2VzLlxuICAgICAqIEBhdXRob3IgTWlsbGVyIE1lZGVpcm9zXG4gICAgICogQGNvbnN0cnVjdG9yXG4gICAgICogQGludGVybmFsXG4gICAgICogQG5hbWUgU2lnbmFsQmluZGluZ1xuICAgICAqIEBwYXJhbSB7U2lnbmFsfSBzaWduYWwgUmVmZXJlbmNlIHRvIFNpZ25hbCBvYmplY3QgdGhhdCBsaXN0ZW5lciBpcyBjdXJyZW50bHkgYm91bmQgdG8uXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXIgSGFuZGxlciBmdW5jdGlvbiBib3VuZCB0byB0aGUgc2lnbmFsLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNPbmNlIElmIGJpbmRpbmcgc2hvdWxkIGJlIGV4ZWN1dGVkIGp1c3Qgb25jZS5cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2xpc3RlbmVyQ29udGV4dF0gQ29udGV4dCBvbiB3aGljaCBsaXN0ZW5lciB3aWxsIGJlIGV4ZWN1dGVkIChvYmplY3QgdGhhdCBzaG91bGQgcmVwcmVzZW50IHRoZSBgdGhpc2AgdmFyaWFibGUgaW5zaWRlIGxpc3RlbmVyIGZ1bmN0aW9uKS5cbiAgICAgKiBAcGFyYW0ge051bWJlcn0gW3ByaW9yaXR5XSBUaGUgcHJpb3JpdHkgbGV2ZWwgb2YgdGhlIGV2ZW50IGxpc3RlbmVyLiAoZGVmYXVsdCA9IDApLlxuICAgICAqL1xuICAgIGZ1bmN0aW9uIFNpZ25hbEJpbmRpbmcoc2lnbmFsLCBsaXN0ZW5lciwgaXNPbmNlLCBsaXN0ZW5lckNvbnRleHQsIHByaW9yaXR5KSB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEhhbmRsZXIgZnVuY3Rpb24gYm91bmQgdG8gdGhlIHNpZ25hbC5cbiAgICAgICAgICogQHR5cGUgRnVuY3Rpb25cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2xpc3RlbmVyID0gbGlzdGVuZXI7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIElmIGJpbmRpbmcgc2hvdWxkIGJlIGV4ZWN1dGVkIGp1c3Qgb25jZS5cbiAgICAgICAgICogQHR5cGUgYm9vbGVhblxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5faXNPbmNlID0gaXNPbmNlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDb250ZXh0IG9uIHdoaWNoIGxpc3RlbmVyIHdpbGwgYmUgZXhlY3V0ZWQgKG9iamVjdCB0aGF0IHNob3VsZCByZXByZXNlbnQgdGhlIGB0aGlzYCB2YXJpYWJsZSBpbnNpZGUgbGlzdGVuZXIgZnVuY3Rpb24pLlxuICAgICAgICAgKiBAbWVtYmVyT2YgU2lnbmFsQmluZGluZy5wcm90b3R5cGVcbiAgICAgICAgICogQG5hbWUgY29udGV4dFxuICAgICAgICAgKiBAdHlwZSBPYmplY3R8dW5kZWZpbmVkfG51bGxcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuY29udGV4dCA9IGxpc3RlbmVyQ29udGV4dDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVmZXJlbmNlIHRvIFNpZ25hbCBvYmplY3QgdGhhdCBsaXN0ZW5lciBpcyBjdXJyZW50bHkgYm91bmQgdG8uXG4gICAgICAgICAqIEB0eXBlIFNpZ25hbFxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fc2lnbmFsID0gc2lnbmFsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBMaXN0ZW5lciBwcmlvcml0eVxuICAgICAgICAgKiBAdHlwZSBOdW1iZXJcbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3ByaW9yaXR5ID0gcHJpb3JpdHkgfHwgMDtcbiAgICB9XG5cbiAgICBTaWduYWxCaW5kaW5nLnByb3RvdHlwZSA9IHtcblxuICAgICAgICAvKipcbiAgICAgICAgICogSWYgYmluZGluZyBpcyBhY3RpdmUgYW5kIHNob3VsZCBiZSBleGVjdXRlZC5cbiAgICAgICAgICogQHR5cGUgYm9vbGVhblxuICAgICAgICAgKi9cbiAgICAgICAgYWN0aXZlIDogdHJ1ZSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogRGVmYXVsdCBwYXJhbWV0ZXJzIHBhc3NlZCB0byBsaXN0ZW5lciBkdXJpbmcgYFNpZ25hbC5kaXNwYXRjaGAgYW5kIGBTaWduYWxCaW5kaW5nLmV4ZWN1dGVgLiAoY3VycmllZCBwYXJhbWV0ZXJzKVxuICAgICAgICAgKiBAdHlwZSBBcnJheXxudWxsXG4gICAgICAgICAqL1xuICAgICAgICBwYXJhbXMgOiBudWxsLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDYWxsIGxpc3RlbmVyIHBhc3NpbmcgYXJiaXRyYXJ5IHBhcmFtZXRlcnMuXG4gICAgICAgICAqIDxwPklmIGJpbmRpbmcgd2FzIGFkZGVkIHVzaW5nIGBTaWduYWwuYWRkT25jZSgpYCBpdCB3aWxsIGJlIGF1dG9tYXRpY2FsbHkgcmVtb3ZlZCBmcm9tIHNpZ25hbCBkaXNwYXRjaCBxdWV1ZSwgdGhpcyBtZXRob2QgaXMgdXNlZCBpbnRlcm5hbGx5IGZvciB0aGUgc2lnbmFsIGRpc3BhdGNoLjwvcD5cbiAgICAgICAgICogQHBhcmFtIHtBcnJheX0gW3BhcmFtc0Fycl0gQXJyYXkgb2YgcGFyYW1ldGVycyB0aGF0IHNob3VsZCBiZSBwYXNzZWQgdG8gdGhlIGxpc3RlbmVyXG4gICAgICAgICAqIEByZXR1cm4geyp9IFZhbHVlIHJldHVybmVkIGJ5IHRoZSBsaXN0ZW5lci5cbiAgICAgICAgICovXG4gICAgICAgIGV4ZWN1dGUgOiBmdW5jdGlvbiAocGFyYW1zQXJyKSB7XG4gICAgICAgICAgICB2YXIgaGFuZGxlclJldHVybiwgcGFyYW1zO1xuICAgICAgICAgICAgaWYgKHRoaXMuYWN0aXZlICYmICEhdGhpcy5fbGlzdGVuZXIpIHtcbiAgICAgICAgICAgICAgICBwYXJhbXMgPSB0aGlzLnBhcmFtcz8gdGhpcy5wYXJhbXMuY29uY2F0KHBhcmFtc0FycikgOiBwYXJhbXNBcnI7XG4gICAgICAgICAgICAgICAgaGFuZGxlclJldHVybiA9IHRoaXMuX2xpc3RlbmVyLmFwcGx5KHRoaXMuY29udGV4dCwgcGFyYW1zKTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5faXNPbmNlKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZGV0YWNoKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGhhbmRsZXJSZXR1cm47XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIERldGFjaCBiaW5kaW5nIGZyb20gc2lnbmFsLlxuICAgICAgICAgKiAtIGFsaWFzIHRvOiBteVNpZ25hbC5yZW1vdmUobXlCaW5kaW5nLmdldExpc3RlbmVyKCkpO1xuICAgICAgICAgKiBAcmV0dXJuIHtGdW5jdGlvbnxudWxsfSBIYW5kbGVyIGZ1bmN0aW9uIGJvdW5kIHRvIHRoZSBzaWduYWwgb3IgYG51bGxgIGlmIGJpbmRpbmcgd2FzIHByZXZpb3VzbHkgZGV0YWNoZWQuXG4gICAgICAgICAqL1xuICAgICAgICBkZXRhY2ggOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5pc0JvdW5kKCk/IHRoaXMuX3NpZ25hbC5yZW1vdmUodGhpcy5fbGlzdGVuZXIsIHRoaXMuY29udGV4dCkgOiBudWxsO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAcmV0dXJuIHtCb29sZWFufSBgdHJ1ZWAgaWYgYmluZGluZyBpcyBzdGlsbCBib3VuZCB0byB0aGUgc2lnbmFsIGFuZCBoYXZlIGEgbGlzdGVuZXIuXG4gICAgICAgICAqL1xuICAgICAgICBpc0JvdW5kIDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuICghIXRoaXMuX3NpZ25hbCAmJiAhIXRoaXMuX2xpc3RlbmVyKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHJldHVybiB7Ym9vbGVhbn0gSWYgU2lnbmFsQmluZGluZyB3aWxsIG9ubHkgYmUgZXhlY3V0ZWQgb25jZS5cbiAgICAgICAgICovXG4gICAgICAgIGlzT25jZSA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9pc09uY2U7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEByZXR1cm4ge0Z1bmN0aW9ufSBIYW5kbGVyIGZ1bmN0aW9uIGJvdW5kIHRvIHRoZSBzaWduYWwuXG4gICAgICAgICAqL1xuICAgICAgICBnZXRMaXN0ZW5lciA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9saXN0ZW5lcjtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHJldHVybiB7U2lnbmFsfSBTaWduYWwgdGhhdCBsaXN0ZW5lciBpcyBjdXJyZW50bHkgYm91bmQgdG8uXG4gICAgICAgICAqL1xuICAgICAgICBnZXRTaWduYWwgOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fc2lnbmFsO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBEZWxldGUgaW5zdGFuY2UgcHJvcGVydGllc1xuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgX2Rlc3Ryb3kgOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fc2lnbmFsO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2xpc3RlbmVyO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuY29udGV4dDtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHJldHVybiB7c3RyaW5nfSBTdHJpbmcgcmVwcmVzZW50YXRpb24gb2YgdGhlIG9iamVjdC5cbiAgICAgICAgICovXG4gICAgICAgIHRvU3RyaW5nIDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuICdbU2lnbmFsQmluZGluZyBpc09uY2U6JyArIHRoaXMuX2lzT25jZSArJywgaXNCb3VuZDonKyB0aGlzLmlzQm91bmQoKSArJywgYWN0aXZlOicgKyB0aGlzLmFjdGl2ZSArICddJztcbiAgICAgICAgfVxuXG4gICAgfTtcblxuXG4vKmdsb2JhbCBTaWduYWxCaW5kaW5nOmZhbHNlKi9cblxuICAgIC8vIFNpZ25hbCAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgZnVuY3Rpb24gdmFsaWRhdGVMaXN0ZW5lcihsaXN0ZW5lciwgZm5OYW1lKSB7XG4gICAgICAgIGlmICh0eXBlb2YgbGlzdGVuZXIgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvciggJ2xpc3RlbmVyIGlzIGEgcmVxdWlyZWQgcGFyYW0gb2Yge2ZufSgpIGFuZCBzaG91bGQgYmUgYSBGdW5jdGlvbi4nLnJlcGxhY2UoJ3tmbn0nLCBmbk5hbWUpICk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDdXN0b20gZXZlbnQgYnJvYWRjYXN0ZXJcbiAgICAgKiA8YnIgLz4tIGluc3BpcmVkIGJ5IFJvYmVydCBQZW5uZXIncyBBUzMgU2lnbmFscy5cbiAgICAgKiBAbmFtZSBTaWduYWxcbiAgICAgKiBAYXV0aG9yIE1pbGxlciBNZWRlaXJvc1xuICAgICAqIEBjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGZ1bmN0aW9uIFNpZ25hbCgpIHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIEFycmF5LjxTaWduYWxCaW5kaW5nPlxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fYmluZGluZ3MgPSBbXTtcbiAgICAgICAgdGhpcy5fcHJldlBhcmFtcyA9IG51bGw7XG5cbiAgICAgICAgLy8gZW5mb3JjZSBkaXNwYXRjaCB0byBhd2F5cyB3b3JrIG9uIHNhbWUgY29udGV4dCAoIzQ3KVxuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHRoaXMuZGlzcGF0Y2ggPSBmdW5jdGlvbigpe1xuICAgICAgICAgICAgU2lnbmFsLnByb3RvdHlwZS5kaXNwYXRjaC5hcHBseShzZWxmLCBhcmd1bWVudHMpO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIFNpZ25hbC5wcm90b3R5cGUgPSB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNpZ25hbHMgVmVyc2lvbiBOdW1iZXJcbiAgICAgICAgICogQHR5cGUgU3RyaW5nXG4gICAgICAgICAqIEBjb25zdFxuICAgICAgICAgKi9cbiAgICAgICAgVkVSU0lPTiA6ICcxLjAuMCcsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIElmIFNpZ25hbCBzaG91bGQga2VlcCByZWNvcmQgb2YgcHJldmlvdXNseSBkaXNwYXRjaGVkIHBhcmFtZXRlcnMgYW5kXG4gICAgICAgICAqIGF1dG9tYXRpY2FsbHkgZXhlY3V0ZSBsaXN0ZW5lciBkdXJpbmcgYGFkZCgpYC9gYWRkT25jZSgpYCBpZiBTaWduYWwgd2FzXG4gICAgICAgICAqIGFscmVhZHkgZGlzcGF0Y2hlZCBiZWZvcmUuXG4gICAgICAgICAqIEB0eXBlIGJvb2xlYW5cbiAgICAgICAgICovXG4gICAgICAgIG1lbW9yaXplIDogZmFsc2UsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIGJvb2xlYW5cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIF9zaG91bGRQcm9wYWdhdGUgOiB0cnVlLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBJZiBTaWduYWwgaXMgYWN0aXZlIGFuZCBzaG91bGQgYnJvYWRjYXN0IGV2ZW50cy5cbiAgICAgICAgICogPHA+PHN0cm9uZz5JTVBPUlRBTlQ6PC9zdHJvbmc+IFNldHRpbmcgdGhpcyBwcm9wZXJ0eSBkdXJpbmcgYSBkaXNwYXRjaCB3aWxsIG9ubHkgYWZmZWN0IHRoZSBuZXh0IGRpc3BhdGNoLCBpZiB5b3Ugd2FudCB0byBzdG9wIHRoZSBwcm9wYWdhdGlvbiBvZiBhIHNpZ25hbCB1c2UgYGhhbHQoKWAgaW5zdGVhZC48L3A+XG4gICAgICAgICAqIEB0eXBlIGJvb2xlYW5cbiAgICAgICAgICovXG4gICAgICAgIGFjdGl2ZSA6IHRydWUsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyXG4gICAgICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNPbmNlXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbbGlzdGVuZXJDb250ZXh0XVxuICAgICAgICAgKiBAcGFyYW0ge051bWJlcn0gW3ByaW9yaXR5XVxuICAgICAgICAgKiBAcmV0dXJuIHtTaWduYWxCaW5kaW5nfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgX3JlZ2lzdGVyTGlzdGVuZXIgOiBmdW5jdGlvbiAobGlzdGVuZXIsIGlzT25jZSwgbGlzdGVuZXJDb250ZXh0LCBwcmlvcml0eSkge1xuXG4gICAgICAgICAgICB2YXIgcHJldkluZGV4ID0gdGhpcy5faW5kZXhPZkxpc3RlbmVyKGxpc3RlbmVyLCBsaXN0ZW5lckNvbnRleHQpLFxuICAgICAgICAgICAgICAgIGJpbmRpbmc7XG5cbiAgICAgICAgICAgIGlmIChwcmV2SW5kZXggIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgYmluZGluZyA9IHRoaXMuX2JpbmRpbmdzW3ByZXZJbmRleF07XG4gICAgICAgICAgICAgICAgaWYgKGJpbmRpbmcuaXNPbmNlKCkgIT09IGlzT25jZSkge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1lvdSBjYW5ub3QgYWRkJysgKGlzT25jZT8gJycgOiAnT25jZScpICsnKCkgdGhlbiBhZGQnKyAoIWlzT25jZT8gJycgOiAnT25jZScpICsnKCkgdGhlIHNhbWUgbGlzdGVuZXIgd2l0aG91dCByZW1vdmluZyB0aGUgcmVsYXRpb25zaGlwIGZpcnN0LicpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYmluZGluZyA9IG5ldyBTaWduYWxCaW5kaW5nKHRoaXMsIGxpc3RlbmVyLCBpc09uY2UsIGxpc3RlbmVyQ29udGV4dCwgcHJpb3JpdHkpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2FkZEJpbmRpbmcoYmluZGluZyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmKHRoaXMubWVtb3JpemUgJiYgdGhpcy5fcHJldlBhcmFtcyl7XG4gICAgICAgICAgICAgICAgYmluZGluZy5leGVjdXRlKHRoaXMuX3ByZXZQYXJhbXMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gYmluZGluZztcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHBhcmFtIHtTaWduYWxCaW5kaW5nfSBiaW5kaW5nXG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICBfYWRkQmluZGluZyA6IGZ1bmN0aW9uIChiaW5kaW5nKSB7XG4gICAgICAgICAgICAvL3NpbXBsaWZpZWQgaW5zZXJ0aW9uIHNvcnRcbiAgICAgICAgICAgIHZhciBuID0gdGhpcy5fYmluZGluZ3MubGVuZ3RoO1xuICAgICAgICAgICAgZG8geyAtLW47IH0gd2hpbGUgKHRoaXMuX2JpbmRpbmdzW25dICYmIGJpbmRpbmcuX3ByaW9yaXR5IDw9IHRoaXMuX2JpbmRpbmdzW25dLl9wcmlvcml0eSk7XG4gICAgICAgICAgICB0aGlzLl9iaW5kaW5ncy5zcGxpY2UobiArIDEsIDAsIGJpbmRpbmcpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lclxuICAgICAgICAgKiBAcmV0dXJuIHtudW1iZXJ9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICBfaW5kZXhPZkxpc3RlbmVyIDogZnVuY3Rpb24gKGxpc3RlbmVyLCBjb250ZXh0KSB7XG4gICAgICAgICAgICB2YXIgbiA9IHRoaXMuX2JpbmRpbmdzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICBjdXI7XG4gICAgICAgICAgICB3aGlsZSAobi0tKSB7XG4gICAgICAgICAgICAgICAgY3VyID0gdGhpcy5fYmluZGluZ3Nbbl07XG4gICAgICAgICAgICAgICAgaWYgKGN1ci5fbGlzdGVuZXIgPT09IGxpc3RlbmVyICYmIGN1ci5jb250ZXh0ID09PSBjb250ZXh0KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQ2hlY2sgaWYgbGlzdGVuZXIgd2FzIGF0dGFjaGVkIHRvIFNpZ25hbC5cbiAgICAgICAgICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXJcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IFtjb250ZXh0XVxuICAgICAgICAgKiBAcmV0dXJuIHtib29sZWFufSBpZiBTaWduYWwgaGFzIHRoZSBzcGVjaWZpZWQgbGlzdGVuZXIuXG4gICAgICAgICAqL1xuICAgICAgICBoYXMgOiBmdW5jdGlvbiAobGlzdGVuZXIsIGNvbnRleHQpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9pbmRleE9mTGlzdGVuZXIobGlzdGVuZXIsIGNvbnRleHQpICE9PSAtMTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQWRkIGEgbGlzdGVuZXIgdG8gdGhlIHNpZ25hbC5cbiAgICAgICAgICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXIgU2lnbmFsIGhhbmRsZXIgZnVuY3Rpb24uXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbbGlzdGVuZXJDb250ZXh0XSBDb250ZXh0IG9uIHdoaWNoIGxpc3RlbmVyIHdpbGwgYmUgZXhlY3V0ZWQgKG9iamVjdCB0aGF0IHNob3VsZCByZXByZXNlbnQgdGhlIGB0aGlzYCB2YXJpYWJsZSBpbnNpZGUgbGlzdGVuZXIgZnVuY3Rpb24pLlxuICAgICAgICAgKiBAcGFyYW0ge051bWJlcn0gW3ByaW9yaXR5XSBUaGUgcHJpb3JpdHkgbGV2ZWwgb2YgdGhlIGV2ZW50IGxpc3RlbmVyLiBMaXN0ZW5lcnMgd2l0aCBoaWdoZXIgcHJpb3JpdHkgd2lsbCBiZSBleGVjdXRlZCBiZWZvcmUgbGlzdGVuZXJzIHdpdGggbG93ZXIgcHJpb3JpdHkuIExpc3RlbmVycyB3aXRoIHNhbWUgcHJpb3JpdHkgbGV2ZWwgd2lsbCBiZSBleGVjdXRlZCBhdCB0aGUgc2FtZSBvcmRlciBhcyB0aGV5IHdlcmUgYWRkZWQuIChkZWZhdWx0ID0gMClcbiAgICAgICAgICogQHJldHVybiB7U2lnbmFsQmluZGluZ30gQW4gT2JqZWN0IHJlcHJlc2VudGluZyB0aGUgYmluZGluZyBiZXR3ZWVuIHRoZSBTaWduYWwgYW5kIGxpc3RlbmVyLlxuICAgICAgICAgKi9cbiAgICAgICAgYWRkIDogZnVuY3Rpb24gKGxpc3RlbmVyLCBsaXN0ZW5lckNvbnRleHQsIHByaW9yaXR5KSB7XG4gICAgICAgICAgICB2YWxpZGF0ZUxpc3RlbmVyKGxpc3RlbmVyLCAnYWRkJyk7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fcmVnaXN0ZXJMaXN0ZW5lcihsaXN0ZW5lciwgZmFsc2UsIGxpc3RlbmVyQ29udGV4dCwgcHJpb3JpdHkpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBZGQgbGlzdGVuZXIgdG8gdGhlIHNpZ25hbCB0aGF0IHNob3VsZCBiZSByZW1vdmVkIGFmdGVyIGZpcnN0IGV4ZWN1dGlvbiAod2lsbCBiZSBleGVjdXRlZCBvbmx5IG9uY2UpLlxuICAgICAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lciBTaWduYWwgaGFuZGxlciBmdW5jdGlvbi5cbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IFtsaXN0ZW5lckNvbnRleHRdIENvbnRleHQgb24gd2hpY2ggbGlzdGVuZXIgd2lsbCBiZSBleGVjdXRlZCAob2JqZWN0IHRoYXQgc2hvdWxkIHJlcHJlc2VudCB0aGUgYHRoaXNgIHZhcmlhYmxlIGluc2lkZSBsaXN0ZW5lciBmdW5jdGlvbikuXG4gICAgICAgICAqIEBwYXJhbSB7TnVtYmVyfSBbcHJpb3JpdHldIFRoZSBwcmlvcml0eSBsZXZlbCBvZiB0aGUgZXZlbnQgbGlzdGVuZXIuIExpc3RlbmVycyB3aXRoIGhpZ2hlciBwcmlvcml0eSB3aWxsIGJlIGV4ZWN1dGVkIGJlZm9yZSBsaXN0ZW5lcnMgd2l0aCBsb3dlciBwcmlvcml0eS4gTGlzdGVuZXJzIHdpdGggc2FtZSBwcmlvcml0eSBsZXZlbCB3aWxsIGJlIGV4ZWN1dGVkIGF0IHRoZSBzYW1lIG9yZGVyIGFzIHRoZXkgd2VyZSBhZGRlZC4gKGRlZmF1bHQgPSAwKVxuICAgICAgICAgKiBAcmV0dXJuIHtTaWduYWxCaW5kaW5nfSBBbiBPYmplY3QgcmVwcmVzZW50aW5nIHRoZSBiaW5kaW5nIGJldHdlZW4gdGhlIFNpZ25hbCBhbmQgbGlzdGVuZXIuXG4gICAgICAgICAqL1xuICAgICAgICBhZGRPbmNlIDogZnVuY3Rpb24gKGxpc3RlbmVyLCBsaXN0ZW5lckNvbnRleHQsIHByaW9yaXR5KSB7XG4gICAgICAgICAgICB2YWxpZGF0ZUxpc3RlbmVyKGxpc3RlbmVyLCAnYWRkT25jZScpO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3JlZ2lzdGVyTGlzdGVuZXIobGlzdGVuZXIsIHRydWUsIGxpc3RlbmVyQ29udGV4dCwgcHJpb3JpdHkpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZW1vdmUgYSBzaW5nbGUgbGlzdGVuZXIgZnJvbSB0aGUgZGlzcGF0Y2ggcXVldWUuXG4gICAgICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyIEhhbmRsZXIgZnVuY3Rpb24gdGhhdCBzaG91bGQgYmUgcmVtb3ZlZC5cbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IFtjb250ZXh0XSBFeGVjdXRpb24gY29udGV4dCAoc2luY2UgeW91IGNhbiBhZGQgdGhlIHNhbWUgaGFuZGxlciBtdWx0aXBsZSB0aW1lcyBpZiBleGVjdXRpbmcgaW4gYSBkaWZmZXJlbnQgY29udGV4dCkuXG4gICAgICAgICAqIEByZXR1cm4ge0Z1bmN0aW9ufSBMaXN0ZW5lciBoYW5kbGVyIGZ1bmN0aW9uLlxuICAgICAgICAgKi9cbiAgICAgICAgcmVtb3ZlIDogZnVuY3Rpb24gKGxpc3RlbmVyLCBjb250ZXh0KSB7XG4gICAgICAgICAgICB2YWxpZGF0ZUxpc3RlbmVyKGxpc3RlbmVyLCAncmVtb3ZlJyk7XG5cbiAgICAgICAgICAgIHZhciBpID0gdGhpcy5faW5kZXhPZkxpc3RlbmVyKGxpc3RlbmVyLCBjb250ZXh0KTtcbiAgICAgICAgICAgIGlmIChpICE9PSAtMSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRpbmdzW2ldLl9kZXN0cm95KCk7IC8vbm8gcmVhc29uIHRvIGEgU2lnbmFsQmluZGluZyBleGlzdCBpZiBpdCBpc24ndCBhdHRhY2hlZCB0byBhIHNpZ25hbFxuICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRpbmdzLnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBsaXN0ZW5lcjtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVtb3ZlIGFsbCBsaXN0ZW5lcnMgZnJvbSB0aGUgU2lnbmFsLlxuICAgICAgICAgKi9cbiAgICAgICAgcmVtb3ZlQWxsIDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIG4gPSB0aGlzLl9iaW5kaW5ncy5sZW5ndGg7XG4gICAgICAgICAgICB3aGlsZSAobi0tKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYmluZGluZ3Nbbl0uX2Rlc3Ryb3koKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuX2JpbmRpbmdzLmxlbmd0aCA9IDA7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEByZXR1cm4ge251bWJlcn0gTnVtYmVyIG9mIGxpc3RlbmVycyBhdHRhY2hlZCB0byB0aGUgU2lnbmFsLlxuICAgICAgICAgKi9cbiAgICAgICAgZ2V0TnVtTGlzdGVuZXJzIDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2JpbmRpbmdzLmxlbmd0aDtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogU3RvcCBwcm9wYWdhdGlvbiBvZiB0aGUgZXZlbnQsIGJsb2NraW5nIHRoZSBkaXNwYXRjaCB0byBuZXh0IGxpc3RlbmVycyBvbiB0aGUgcXVldWUuXG4gICAgICAgICAqIDxwPjxzdHJvbmc+SU1QT1JUQU5UOjwvc3Ryb25nPiBzaG91bGQgYmUgY2FsbGVkIG9ubHkgZHVyaW5nIHNpZ25hbCBkaXNwYXRjaCwgY2FsbGluZyBpdCBiZWZvcmUvYWZ0ZXIgZGlzcGF0Y2ggd29uJ3QgYWZmZWN0IHNpZ25hbCBicm9hZGNhc3QuPC9wPlxuICAgICAgICAgKiBAc2VlIFNpZ25hbC5wcm90b3R5cGUuZGlzYWJsZVxuICAgICAgICAgKi9cbiAgICAgICAgaGFsdCA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHRoaXMuX3Nob3VsZFByb3BhZ2F0ZSA9IGZhbHNlO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBEaXNwYXRjaC9Ccm9hZGNhc3QgU2lnbmFsIHRvIGFsbCBsaXN0ZW5lcnMgYWRkZWQgdG8gdGhlIHF1ZXVlLlxuICAgICAgICAgKiBAcGFyYW0gey4uLip9IFtwYXJhbXNdIFBhcmFtZXRlcnMgdGhhdCBzaG91bGQgYmUgcGFzc2VkIHRvIGVhY2ggaGFuZGxlci5cbiAgICAgICAgICovXG4gICAgICAgIGRpc3BhdGNoIDogZnVuY3Rpb24gKHBhcmFtcykge1xuICAgICAgICAgICAgaWYgKCEgdGhpcy5hY3RpdmUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBwYXJhbXNBcnIgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpLFxuICAgICAgICAgICAgICAgIG4gPSB0aGlzLl9iaW5kaW5ncy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgYmluZGluZ3M7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLm1lbW9yaXplKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcHJldlBhcmFtcyA9IHBhcmFtc0FycjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCEgbikge1xuICAgICAgICAgICAgICAgIC8vc2hvdWxkIGNvbWUgYWZ0ZXIgbWVtb3JpemVcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGJpbmRpbmdzID0gdGhpcy5fYmluZGluZ3Muc2xpY2UoKTsgLy9jbG9uZSBhcnJheSBpbiBjYXNlIGFkZC9yZW1vdmUgaXRlbXMgZHVyaW5nIGRpc3BhdGNoXG4gICAgICAgICAgICB0aGlzLl9zaG91bGRQcm9wYWdhdGUgPSB0cnVlOyAvL2luIGNhc2UgYGhhbHRgIHdhcyBjYWxsZWQgYmVmb3JlIGRpc3BhdGNoIG9yIGR1cmluZyB0aGUgcHJldmlvdXMgZGlzcGF0Y2guXG5cbiAgICAgICAgICAgIC8vZXhlY3V0ZSBhbGwgY2FsbGJhY2tzIHVudGlsIGVuZCBvZiB0aGUgbGlzdCBvciB1bnRpbCBhIGNhbGxiYWNrIHJldHVybnMgYGZhbHNlYCBvciBzdG9wcyBwcm9wYWdhdGlvblxuICAgICAgICAgICAgLy9yZXZlcnNlIGxvb3Agc2luY2UgbGlzdGVuZXJzIHdpdGggaGlnaGVyIHByaW9yaXR5IHdpbGwgYmUgYWRkZWQgYXQgdGhlIGVuZCBvZiB0aGUgbGlzdFxuICAgICAgICAgICAgZG8geyBuLS07IH0gd2hpbGUgKGJpbmRpbmdzW25dICYmIHRoaXMuX3Nob3VsZFByb3BhZ2F0ZSAmJiBiaW5kaW5nc1tuXS5leGVjdXRlKHBhcmFtc0FycikgIT09IGZhbHNlKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogRm9yZ2V0IG1lbW9yaXplZCBhcmd1bWVudHMuXG4gICAgICAgICAqIEBzZWUgU2lnbmFsLm1lbW9yaXplXG4gICAgICAgICAqL1xuICAgICAgICBmb3JnZXQgOiBmdW5jdGlvbigpe1xuICAgICAgICAgICAgdGhpcy5fcHJldlBhcmFtcyA9IG51bGw7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJlbW92ZSBhbGwgYmluZGluZ3MgZnJvbSBzaWduYWwgYW5kIGRlc3Ryb3kgYW55IHJlZmVyZW5jZSB0byBleHRlcm5hbCBvYmplY3RzIChkZXN0cm95IFNpZ25hbCBvYmplY3QpLlxuICAgICAgICAgKiA8cD48c3Ryb25nPklNUE9SVEFOVDo8L3N0cm9uZz4gY2FsbGluZyBhbnkgbWV0aG9kIG9uIHRoZSBzaWduYWwgaW5zdGFuY2UgYWZ0ZXIgY2FsbGluZyBkaXNwb3NlIHdpbGwgdGhyb3cgZXJyb3JzLjwvcD5cbiAgICAgICAgICovXG4gICAgICAgIGRpc3Bvc2UgOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aGlzLnJlbW92ZUFsbCgpO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2JpbmRpbmdzO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX3ByZXZQYXJhbXM7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEByZXR1cm4ge3N0cmluZ30gU3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBvYmplY3QuXG4gICAgICAgICAqL1xuICAgICAgICB0b1N0cmluZyA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiAnW1NpZ25hbCBhY3RpdmU6JysgdGhpcy5hY3RpdmUgKycgbnVtTGlzdGVuZXJzOicrIHRoaXMuZ2V0TnVtTGlzdGVuZXJzKCkgKyddJztcbiAgICAgICAgfVxuXG4gICAgfTtcblxuXG4gICAgLy8gTmFtZXNwYWNlIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy89PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAvKipcbiAgICAgKiBTaWduYWxzIG5hbWVzcGFjZVxuICAgICAqIEBuYW1lc3BhY2VcbiAgICAgKiBAbmFtZSBzaWduYWxzXG4gICAgICovXG4gICAgdmFyIHNpZ25hbHMgPSBTaWduYWw7XG5cbiAgICAvKipcbiAgICAgKiBDdXN0b20gZXZlbnQgYnJvYWRjYXN0ZXJcbiAgICAgKiBAc2VlIFNpZ25hbFxuICAgICAqL1xuICAgIC8vIGFsaWFzIGZvciBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eSAoc2VlICNnaC00NClcbiAgICBzaWduYWxzLlNpZ25hbCA9IFNpZ25hbDtcblxuXG5cbiAgICAvL2V4cG9ydHMgdG8gbXVsdGlwbGUgZW52aXJvbm1lbnRzXG4gICAgaWYodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKXsgLy9BTURcbiAgICAgICAgZGVmaW5lKGZ1bmN0aW9uICgpIHsgcmV0dXJuIHNpZ25hbHM7IH0pO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMpeyAvL25vZGVcbiAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSBzaWduYWxzO1xuICAgIH0gZWxzZSB7IC8vYnJvd3NlclxuICAgICAgICAvL3VzZSBzdHJpbmcgYmVjYXVzZSBvZiBHb29nbGUgY2xvc3VyZSBjb21waWxlciBBRFZBTkNFRF9NT0RFXG4gICAgICAgIC8qanNsaW50IHN1Yjp0cnVlICovXG4gICAgICAgIGdsb2JhbFsnc2lnbmFscyddID0gc2lnbmFscztcbiAgICB9XG5cbn0odGhpcykpO1xuIiwiLyoqXG4gKiBUaGUgY29yZSBrYW1pIG1vZHVsZSBwcm92aWRlcyBiYXNpYyAyRCBzcHJpdGUgYmF0Y2hpbmcgYW5kIFxuICogYXNzZXQgbWFuYWdlbWVudC5cbiAqIFxuICogQG1vZHVsZSBrYW1pXG4gKi9cblxudmFyIENsYXNzID0gcmVxdWlyZSgna2xhc3NlJyk7XG52YXIgTWVzaCA9IHJlcXVpcmUoJy4vZ2x1dGlscy9NZXNoJyk7XG5cbnZhciBjb2xvclRvRmxvYXQgPSByZXF1aXJlKCdudW1iZXItdXRpbCcpLmNvbG9yVG9GbG9hdDtcblxuLyoqIFxuICogQSBiYXRjaGVyIG1peGluIGNvbXBvc2VkIG9mIHF1YWRzICh0d28gdHJpcywgaW5kZXhlZCkuIFxuICpcbiAqIFRoaXMgaXMgdXNlZCBpbnRlcm5hbGx5OyB1c2VycyBzaG91bGQgbG9vayBhdCBcbiAqIHt7I2Nyb3NzTGluayBcIlNwcml0ZUJhdGNoXCJ9fXt7L2Nyb3NzTGlua319IGluc3RlYWQsIHdoaWNoIGluaGVyaXRzIGZyb20gdGhpc1xuICogY2xhc3MuXG4gKiBcbiAqIFRoZSBiYXRjaGVyIGl0c2VsZiBpcyBub3QgbWFuYWdlZCBieSBXZWJHTENvbnRleHQ7IGhvd2V2ZXIsIGl0IG1ha2VzXG4gKiB1c2Ugb2YgTWVzaCBhbmQgVGV4dHVyZSB3aGljaCB3aWxsIGJlIG1hbmFnZWQuIEZvciB0aGlzIHJlYXNvbiwgdGhlIGJhdGNoZXJcbiAqIGRvZXMgbm90IGhvbGQgYSBkaXJlY3QgcmVmZXJlbmNlIHRvIHRoZSBHTCBzdGF0ZS5cbiAqXG4gKiBTdWJjbGFzc2VzIG11c3QgaW1wbGVtZW50IHRoZSBmb2xsb3dpbmc6ICBcbiAqIHt7I2Nyb3NzTGluayBcIkJhc2VCYXRjaC9fY3JlYXRlU2hhZGVyOm1ldGhvZFwifX17ey9jcm9zc0xpbmt9fSAgXG4gKiB7eyNjcm9zc0xpbmsgXCJCYXNlQmF0Y2gvX2NyZWF0ZVZlcnRleEF0dHJpYnV0ZXM6bWV0aG9kXCJ9fXt7L2Nyb3NzTGlua319ICBcbiAqIHt7I2Nyb3NzTGluayBcIkJhc2VCYXRjaC9nZXRWZXJ0ZXhTaXplOm1ldGhvZFwifX17ey9jcm9zc0xpbmt9fSAgXG4gKiBcbiAqIEBjbGFzcyAgQmFzZUJhdGNoXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSB7V2ViR0xDb250ZXh0fSBjb250ZXh0IHRoZSBjb250ZXh0IHRoaXMgYmF0Y2hlciBiZWxvbmdzIHRvXG4gKiBAcGFyYW0ge051bWJlcn0gc2l6ZSB0aGUgb3B0aW9uYWwgc2l6ZSBvZiB0aGlzIGJhdGNoLCBpLmUuIG1heCBudW1iZXIgb2YgcXVhZHNcbiAqIEBkZWZhdWx0ICA1MDBcbiAqL1xudmFyIEJhc2VCYXRjaCA9IG5ldyBDbGFzcyh7XG5cblx0Ly9Db25zdHJ1Y3RvclxuXHRpbml0aWFsaXplOiBmdW5jdGlvbiBCYXNlQmF0Y2goY29udGV4dCwgc2l6ZSkge1xuXHRcdGlmICh0eXBlb2YgY29udGV4dCAhPT0gXCJvYmplY3RcIilcblx0XHRcdHRocm93IFwiR0wgY29udGV4dCBub3Qgc3BlY2lmaWVkIHRvIFNwcml0ZUJhdGNoXCI7XG5cdFx0dGhpcy5jb250ZXh0ID0gY29udGV4dDtcblxuXHRcdHRoaXMuc2l6ZSA9IHNpemUgfHwgNTAwO1xuXHRcdFxuXHRcdC8vIDY1NTM1IGlzIG1heCBpbmRleCwgc28gNjU1MzUgLyA2ID0gMTA5MjIuXG5cdFx0aWYgKHRoaXMuc2l6ZSA+IDEwOTIyKSAgLy8oeW91J2QgaGF2ZSB0byBiZSBpbnNhbmUgdG8gdHJ5IGFuZCBiYXRjaCB0aGlzIG11Y2ggd2l0aCBXZWJHTClcblx0XHRcdHRocm93IFwiQ2FuJ3QgaGF2ZSBtb3JlIHRoYW4gMTA5MjIgc3ByaXRlcyBwZXIgYmF0Y2g6IFwiICsgdGhpcy5zaXplO1xuXHRcdFx0XHRcblx0XHRcblx0XHRcblx0XHR0aGlzLl9ibGVuZFNyYyA9IHRoaXMuY29udGV4dC5nbC5PTkU7XG5cdFx0dGhpcy5fYmxlbmREc3QgPSB0aGlzLmNvbnRleHQuZ2wuT05FX01JTlVTX1NSQ19BTFBIQVxuXHRcdHRoaXMuX2JsZW5kaW5nRW5hYmxlZCA9IHRydWU7XG5cdFx0dGhpcy5fc2hhZGVyID0gdGhpcy5fY3JlYXRlU2hhZGVyKCk7XG5cblx0XHQvKipcblx0XHQgKiBUaGlzIHNoYWRlciB3aWxsIGJlIHVzZWQgd2hlbmV2ZXIgXCJudWxsXCIgaXMgcGFzc2VkXG5cdFx0ICogYXMgdGhlIGJhdGNoJ3Mgc2hhZGVyLiBcblx0XHQgKlxuXHRcdCAqIEBwcm9wZXJ0eSB7U2hhZGVyUHJvZ3JhbX0gc2hhZGVyXG5cdFx0ICovXG5cdFx0dGhpcy5kZWZhdWx0U2hhZGVyID0gdGhpcy5fc2hhZGVyO1xuXG5cdFx0LyoqXG5cdFx0ICogQnkgZGVmYXVsdCwgYSBTcHJpdGVCYXRjaCBpcyBjcmVhdGVkIHdpdGggaXRzIG93biBTaGFkZXJQcm9ncmFtLFxuXHRcdCAqIHN0b3JlZCBpbiBgZGVmYXVsdFNoYWRlcmAuIElmIHRoaXMgZmxhZyBpcyB0cnVlLCBvbiBkZWxldGluZyB0aGUgU3ByaXRlQmF0Y2gsIGl0c1xuXHRcdCAqIGBkZWZhdWx0U2hhZGVyYCB3aWxsIGFsc28gYmUgZGVsZXRlZC4gSWYgdGhpcyBmbGFnIGlzIGZhbHNlLCBubyBzaGFkZXJzXG5cdFx0ICogd2lsbCBiZSBkZWxldGVkIG9uIGRlc3Ryb3kuXG5cdFx0ICpcblx0XHQgKiBOb3RlIHRoYXQgaWYgeW91IHJlLWFzc2lnbiBgZGVmYXVsdFNoYWRlcmAsIHlvdSB3aWxsIG5lZWQgdG8gZGlzcG9zZSB0aGUgcHJldmlvdXNcblx0XHQgKiBkZWZhdWx0IHNoYWRlciB5b3Vyc2VsLiBcblx0XHQgKlxuXHRcdCAqIEBwcm9wZXJ0eSBvd25zU2hhZGVyXG5cdFx0ICogQHR5cGUge0Jvb2xlYW59XG5cdFx0ICovXG5cdFx0dGhpcy5vd25zU2hhZGVyID0gdHJ1ZTtcblxuXHRcdHRoaXMuaWR4ID0gMDtcblxuXHRcdC8qKlxuXHRcdCAqIFdoZXRoZXIgd2UgYXJlIGN1cnJlbnRseSBkcmF3aW5nIHRvIHRoZSBiYXRjaC4gRG8gbm90IG1vZGlmeS5cblx0XHQgKiBcblx0XHQgKiBAcHJvcGVydHkge0Jvb2xlYW59IGRyYXdpbmdcblx0XHQgKi9cblx0XHR0aGlzLmRyYXdpbmcgPSBmYWxzZTtcblxuXHRcdHRoaXMubWVzaCA9IHRoaXMuX2NyZWF0ZU1lc2godGhpcy5zaXplKTtcblxuXG5cdFx0LyoqXG5cdFx0ICogVGhlIEFCR1IgcGFja2VkIGNvbG9yLCBhcyBhIHNpbmdsZSBmbG9hdC4gVGhlIGRlZmF1bHRcblx0XHQgKiB2YWx1ZSBpcyB0aGUgY29sb3Igd2hpdGUgKDI1NSwgMjU1LCAyNTUsIDI1NSkuXG5cdFx0ICpcblx0XHQgKiBAcHJvcGVydHkge051bWJlcn0gY29sb3Jcblx0XHQgKiBAcmVhZE9ubHkgXG5cdFx0ICovXG5cdFx0dGhpcy5jb2xvciA9IGNvbG9yVG9GbG9hdCgyNTUsIDI1NSwgMjU1LCAyNTUpO1xuXHRcdFxuXHRcdC8qKlxuXHRcdCAqIFdoZXRoZXIgdG8gcHJlbXVsdGlwbHkgYWxwaGEgb24gY2FsbHMgdG8gc2V0Q29sb3IuIFxuXHRcdCAqIFRoaXMgaXMgdHJ1ZSBieSBkZWZhdWx0LCBzbyB0aGF0IHdlIGNhbiBjb252ZW5pZW50bHkgd3JpdGU6XG5cdFx0ICpcblx0XHQgKiAgICAgYmF0Y2guc2V0Q29sb3IoMSwgMCwgMCwgMC4yNSk7IC8vdGludHMgcmVkIHdpdGggMjUlIG9wYWNpdHlcblx0XHQgKlxuXHRcdCAqIElmIGZhbHNlLCB5b3UgbXVzdCBwcmVtdWx0aXBseSB0aGUgY29sb3JzIHlvdXJzZWxmIHRvIGFjaGlldmVcblx0XHQgKiB0aGUgc2FtZSB0aW50LCBsaWtlIHNvOlxuXHRcdCAqXG5cdFx0ICogICAgIGJhdGNoLnNldENvbG9yKDAuMjUsIDAsIDAsIDAuMjUpO1xuXHRcdCAqIFxuXHRcdCAqIEBwcm9wZXJ0eSBwcmVtdWx0aXBsaWVkXG5cdFx0ICogQHR5cGUge0Jvb2xlYW59XG5cdFx0ICogQGRlZmF1bHQgIHRydWVcblx0XHQgKi9cblx0XHR0aGlzLnByZW11bHRpcGxpZWQgPSB0cnVlO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBBIHByb3BlcnR5IHRvIGVuYWJsZSBvciBkaXNhYmxlIGJsZW5kaW5nIGZvciB0aGlzIHNwcml0ZSBiYXRjaC4gSWZcblx0ICogd2UgYXJlIGN1cnJlbnRseSBkcmF3aW5nLCB0aGlzIHdpbGwgZmlyc3QgZmx1c2ggdGhlIGJhdGNoLCBhbmQgdGhlblxuXHQgKiB1cGRhdGUgR0xfQkxFTkQgc3RhdGUgKGVuYWJsZWQgb3IgZGlzYWJsZWQpIHdpdGggb3VyIG5ldyB2YWx1ZS5cblx0ICogXG5cdCAqIEBwcm9wZXJ0eSB7Qm9vbGVhbn0gYmxlbmRpbmdFbmFibGVkXG5cdCAqL1xuXHRibGVuZGluZ0VuYWJsZWQ6IHtcblx0XHRzZXQ6IGZ1bmN0aW9uKHZhbCkge1xuXHRcdFx0dmFyIG9sZCA9IHRoaXMuX2JsZW5kaW5nRW5hYmxlZDtcblx0XHRcdGlmICh0aGlzLmRyYXdpbmcpXG5cdFx0XHRcdHRoaXMuZmx1c2goKTtcblxuXHRcdFx0dGhpcy5fYmxlbmRpbmdFbmFibGVkID0gdmFsO1xuXG5cdFx0XHQvL2lmIHdlIGhhdmUgYSBuZXcgdmFsdWUsIHVwZGF0ZSBpdC5cblx0XHRcdC8vdGhpcyBpcyBiZWNhdXNlIGJsZW5kIGlzIGRvbmUgaW4gYmVnaW4oKSAvIGVuZCgpIFxuXHRcdFx0aWYgKHRoaXMuZHJhd2luZyAmJiBvbGQgIT0gdmFsKSB7XG5cdFx0XHRcdHZhciBnbCA9IHRoaXMuY29udGV4dC5nbDtcblx0XHRcdFx0aWYgKHZhbClcblx0XHRcdFx0XHRnbC5lbmFibGUoZ2wuQkxFTkQpO1xuXHRcdFx0XHRlbHNlXG5cdFx0XHRcdFx0Z2wuZGlzYWJsZShnbC5CTEVORCk7XG5cdFx0XHR9XG5cblx0XHR9LFxuXG5cdFx0Z2V0OiBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiB0aGlzLl9ibGVuZGluZ0VuYWJsZWQ7XG5cdFx0fVxuXHR9LFxuXG5cdC8qKlxuXHQgKiBTZXRzIHRoZSBibGVuZCBzb3VyY2UgcGFyYW1ldGVycy4gXG5cdCAqIElmIHdlIGFyZSBjdXJyZW50bHkgZHJhd2luZywgdGhpcyB3aWxsIGZsdXNoIHRoZSBiYXRjaC5cblx0ICpcblx0ICogU2V0dGluZyBlaXRoZXIgc3JjIG9yIGRzdCB0byBgbnVsbGAgb3IgYSBmYWxzeSB2YWx1ZSB0ZWxscyB0aGUgU3ByaXRlQmF0Y2hcblx0ICogdG8gaWdub3JlIGdsLmJsZW5kRnVuYy4gVGhpcyBpcyB1c2VmdWwgaWYgeW91IHdpc2ggdG8gdXNlIHlvdXJcblx0ICogb3duIGJsZW5kRnVuYyBvciBibGVuZEZ1bmNTZXBhcmF0ZS4gXG5cdCAqIFxuXHQgKiBAcHJvcGVydHkge0dMZW51bX0gYmxlbmREc3QgXG5cdCAqL1xuXHRibGVuZFNyYzoge1xuXHRcdHNldDogZnVuY3Rpb24odmFsKSB7XG5cdFx0XHRpZiAodGhpcy5kcmF3aW5nKVxuXHRcdFx0XHR0aGlzLmZsdXNoKCk7XG5cdFx0XHR0aGlzLl9ibGVuZFNyYyA9IHZhbDtcblx0XHR9LFxuXG5cdFx0Z2V0OiBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiB0aGlzLl9ibGVuZFNyYztcblx0XHR9XG5cdH0sXG5cblx0LyoqXG5cdCAqIFNldHMgdGhlIGJsZW5kIGRlc3RpbmF0aW9uIHBhcmFtZXRlcnMuIFxuXHQgKiBJZiB3ZSBhcmUgY3VycmVudGx5IGRyYXdpbmcsIHRoaXMgd2lsbCBmbHVzaCB0aGUgYmF0Y2guXG5cdCAqXG5cdCAqIFNldHRpbmcgZWl0aGVyIHNyYyBvciBkc3QgdG8gYG51bGxgIG9yIGEgZmFsc3kgdmFsdWUgdGVsbHMgdGhlIFNwcml0ZUJhdGNoXG5cdCAqIHRvIGlnbm9yZSBnbC5ibGVuZEZ1bmMuIFRoaXMgaXMgdXNlZnVsIGlmIHlvdSB3aXNoIHRvIHVzZSB5b3VyXG5cdCAqIG93biBibGVuZEZ1bmMgb3IgYmxlbmRGdW5jU2VwYXJhdGUuIFxuXHQgKlxuXHQgKiBAcHJvcGVydHkge0dMZW51bX0gYmxlbmRTcmMgXG5cdCAqL1xuXHRibGVuZERzdDoge1xuXHRcdHNldDogZnVuY3Rpb24odmFsKSB7XG5cdFx0XHRpZiAodGhpcy5kcmF3aW5nKVxuXHRcdFx0XHR0aGlzLmZsdXNoKCk7XG5cdFx0XHR0aGlzLl9ibGVuZERzdCA9IHZhbDtcblx0XHR9LFxuXG5cdFx0Z2V0OiBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiB0aGlzLl9ibGVuZERzdDtcblx0XHR9XG5cdH0sXG5cblx0LyoqXG5cdCAqIFNldHMgdGhlIGJsZW5kIHNvdXJjZSBhbmQgZGVzdGluYXRpb24gcGFyYW1ldGVycy4gVGhpcyBpcyBcblx0ICogYSBjb252ZW5pZW5jZSBmdW5jdGlvbiBmb3IgdGhlIGJsZW5kU3JjIGFuZCBibGVuZERzdCBzZXR0ZXJzLlxuXHQgKiBJZiB3ZSBhcmUgY3VycmVudGx5IGRyYXdpbmcsIHRoaXMgd2lsbCBmbHVzaCB0aGUgYmF0Y2guXG5cdCAqXG5cdCAqIFNldHRpbmcgZWl0aGVyIHRvIGBudWxsYCBvciBhIGZhbHN5IHZhbHVlIHRlbGxzIHRoZSBTcHJpdGVCYXRjaFxuXHQgKiB0byBpZ25vcmUgZ2wuYmxlbmRGdW5jLiBUaGlzIGlzIHVzZWZ1bCBpZiB5b3Ugd2lzaCB0byB1c2UgeW91clxuXHQgKiBvd24gYmxlbmRGdW5jIG9yIGJsZW5kRnVuY1NlcGFyYXRlLiBcblx0ICpcblx0ICogQG1ldGhvZCAgc2V0QmxlbmRGdW5jdGlvblxuXHQgKiBAcGFyYW0ge0dMZW51bX0gYmxlbmRTcmMgdGhlIHNvdXJjZSBibGVuZCBwYXJhbWV0ZXJcblx0ICogQHBhcmFtIHtHTGVudW19IGJsZW5kRHN0IHRoZSBkZXN0aW5hdGlvbiBibGVuZCBwYXJhbWV0ZXJcblx0ICovXG5cdHNldEJsZW5kRnVuY3Rpb246IGZ1bmN0aW9uKGJsZW5kU3JjLCBibGVuZERzdCkge1xuXHRcdHRoaXMuYmxlbmRTcmMgPSBibGVuZFNyYztcblx0XHR0aGlzLmJsZW5kRHN0ID0gYmxlbmREc3Q7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFRoaXMgaXMgYSBzZXR0ZXIvZ2V0dGVyIGZvciB0aGlzIGJhdGNoJ3MgY3VycmVudCBTaGFkZXJQcm9ncmFtLlxuXHQgKiBJZiB0aGlzIGlzIHNldCB3aGVuIHRoZSBiYXRjaCBpcyBkcmF3aW5nLCB0aGUgc3RhdGUgd2lsbCBiZSBmbHVzaGVkXG5cdCAqIHRvIHRoZSBHUFUgYW5kIHRoZSBuZXcgc2hhZGVyIHdpbGwgdGhlbiBiZSBib3VuZC5cblx0ICpcblx0ICogSWYgYG51bGxgIG9yIGEgZmFsc3kgdmFsdWUgaXMgc3BlY2lmaWVkLCB0aGUgYmF0Y2gncyBgZGVmYXVsdFNoYWRlcmAgd2lsbCBiZSB1c2VkLiBcblx0ICpcblx0ICogTm90ZSB0aGF0IHNoYWRlcnMgYXJlIGJvdW5kIG9uIGJhdGNoLmJlZ2luKCkuXG5cdCAqXG5cdCAqIEBwcm9wZXJ0eSBzaGFkZXJcblx0ICogQHR5cGUge1NoYWRlclByb2dyYW19XG5cdCAqL1xuXHRzaGFkZXI6IHtcblx0XHRzZXQ6IGZ1bmN0aW9uKHZhbCkge1xuXHRcdFx0dmFyIHdhc0RyYXdpbmcgPSB0aGlzLmRyYXdpbmc7XG5cblx0XHRcdGlmICh3YXNEcmF3aW5nKSB7XG5cdFx0XHRcdHRoaXMuZW5kKCk7IC8vdW5iaW5kcyB0aGUgc2hhZGVyIGZyb20gdGhlIG1lc2hcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fc2hhZGVyID0gdmFsID8gdmFsIDogdGhpcy5kZWZhdWx0U2hhZGVyO1xuXG5cdFx0XHRpZiAod2FzRHJhd2luZykge1xuXHRcdFx0XHR0aGlzLmJlZ2luKCk7XG5cdFx0XHR9XG5cdFx0fSxcblxuXHRcdGdldDogZnVuY3Rpb24oKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fc2hhZGVyO1xuXHRcdH1cblx0fSxcblxuXHQvKipcblx0ICogU2V0cyB0aGUgY29sb3Igb2YgdGhpcyBzcHJpdGUgYmF0Y2hlciwgd2hpY2ggaXMgdXNlZCBpbiBzdWJzZXF1ZW50IGRyYXdcblx0ICogY2FsbHMuIFRoaXMgZG9lcyBub3QgZmx1c2ggdGhlIGJhdGNoLlxuXHQgKlxuXHQgKiBJZiByLCBnLCBiLCBhcmUgYWxsIG51bWJlcnMsIHRoaXMgbWV0aG9kIGFzc3VtZXMgdGhhdCBSR0IgXG5cdCAqIG9yIFJHQkEgZmxvYXQgdmFsdWVzICgwLjAgdG8gMS4wKSBhcmUgYmVpbmcgcGFzc2VkLiBBbHBoYSBkZWZhdWx0cyB0byBvbmVcblx0ICogaWYgdW5kZWZpbmVkLlxuXHQgKiBcblx0ICogSWYgdGhlIGZpcnN0IHRocmVlIGFyZ3VtZW50cyBhcmUgbm90IG51bWJlcnMsIHdlIG9ubHkgY29uc2lkZXIgdGhlIGZpcnN0IGFyZ3VtZW50XG5cdCAqIGFuZCBhc3NpZ24gaXQgdG8gYWxsIGZvdXIgY29tcG9uZW50cyAtLSB0aGlzIGlzIHVzZWZ1bCBmb3Igc2V0dGluZyB0cmFuc3BhcmVuY3kgXG5cdCAqIGluIGEgcHJlbXVsdGlwbGllZCBhbHBoYSBzdGFnZS4gXG5cdCAqIFxuXHQgKiBJZiB0aGUgZmlyc3QgYXJndW1lbnQgaXMgaW52YWxpZCBvciBub3QgYSBudW1iZXIsXG5cdCAqIHRoZSBjb2xvciBkZWZhdWx0cyB0byAoMSwgMSwgMSwgMSkuXG5cdCAqXG5cdCAqIEBtZXRob2QgIHNldENvbG9yXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSByIHRoZSByZWQgY29tcG9uZW50LCBub3JtYWxpemVkXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBnIHRoZSBncmVlbiBjb21wb25lbnQsIG5vcm1hbGl6ZWRcblx0ICogQHBhcmFtIHtOdW1iZXJ9IGIgdGhlIGJsdWUgY29tcG9uZW50LCBub3JtYWxpemVkXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBhIHRoZSBhbHBoYSBjb21wb25lbnQsIG5vcm1hbGl6ZWRcblx0ICovXG5cdHNldENvbG9yOiBmdW5jdGlvbihyLCBnLCBiLCBhKSB7XG5cdFx0dmFyIHJudW0gPSB0eXBlb2YgciA9PT0gXCJudW1iZXJcIjtcblx0XHRpZiAocm51bVxuXHRcdFx0XHQmJiB0eXBlb2YgZyA9PT0gXCJudW1iZXJcIlxuXHRcdFx0XHQmJiB0eXBlb2YgYiA9PT0gXCJudW1iZXJcIikge1xuXHRcdFx0Ly9kZWZhdWx0IGFscGhhIHRvIG9uZSBcblx0XHRcdGEgPSAoYSB8fCBhID09PSAwKSA/IGEgOiAxLjA7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHIgPSBnID0gYiA9IGEgPSBybnVtID8gciA6IDEuMDtcblx0XHR9XG5cdFx0XG5cdFx0aWYgKHRoaXMucHJlbXVsdGlwbGllZCkge1xuXHRcdFx0ciAqPSBhO1xuXHRcdFx0ZyAqPSBhO1xuXHRcdFx0YiAqPSBhO1xuXHRcdH1cblx0XHRcblx0XHR0aGlzLmNvbG9yID0gY29sb3JUb0Zsb2F0KFxuXHRcdFx0fn4ociAqIDI1NSksXG5cdFx0XHR+fihnICogMjU1KSxcblx0XHRcdH5+KGIgKiAyNTUpLFxuXHRcdFx0fn4oYSAqIDI1NSlcblx0XHQpO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBDYWxsZWQgZnJvbSB0aGUgY29uc3RydWN0b3IgdG8gY3JlYXRlIGEgbmV3IE1lc2ggXG5cdCAqIGJhc2VkIG9uIHRoZSBleHBlY3RlZCBiYXRjaCBzaXplLiBTaG91bGQgc2V0IHVwXG5cdCAqIHZlcnRzICYgaW5kaWNlcyBwcm9wZXJseS5cblx0ICpcblx0ICogVXNlcnMgc2hvdWxkIG5vdCBjYWxsIHRoaXMgZGlyZWN0bHk7IGluc3RlYWQsIGl0XG5cdCAqIHNob3VsZCBvbmx5IGJlIGltcGxlbWVudGVkIGJ5IHN1YmNsYXNzZXMuXG5cdCAqIFxuXHQgKiBAbWV0aG9kIF9jcmVhdGVNZXNoXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBzaXplIHRoZSBzaXplIHBhc3NlZCB0aHJvdWdoIHRoZSBjb25zdHJ1Y3RvclxuXHQgKi9cblx0X2NyZWF0ZU1lc2g6IGZ1bmN0aW9uKHNpemUpIHtcblx0XHQvL3RoZSB0b3RhbCBudW1iZXIgb2YgZmxvYXRzIGluIG91ciBiYXRjaFxuXHRcdHZhciBudW1WZXJ0cyA9IHNpemUgKiA0ICogdGhpcy5nZXRWZXJ0ZXhTaXplKCk7XG5cdFx0Ly90aGUgdG90YWwgbnVtYmVyIG9mIGluZGljZXMgaW4gb3VyIGJhdGNoXG5cdFx0dmFyIG51bUluZGljZXMgPSBzaXplICogNjtcblx0XHR2YXIgZ2wgPSB0aGlzLmNvbnRleHQuZ2w7XG5cblx0XHQvL3ZlcnRleCBkYXRhXG5cdFx0dGhpcy52ZXJ0aWNlcyA9IG5ldyBGbG9hdDMyQXJyYXkobnVtVmVydHMpO1xuXHRcdC8vaW5kZXggZGF0YVxuXHRcdHRoaXMuaW5kaWNlcyA9IG5ldyBVaW50MTZBcnJheShudW1JbmRpY2VzKTsgXG5cdFx0XG5cdFx0Zm9yICh2YXIgaT0wLCBqPTA7IGkgPCBudW1JbmRpY2VzOyBpICs9IDYsIGogKz0gNCkgXG5cdFx0e1xuXHRcdFx0dGhpcy5pbmRpY2VzW2kgKyAwXSA9IGogKyAwOyBcblx0XHRcdHRoaXMuaW5kaWNlc1tpICsgMV0gPSBqICsgMTtcblx0XHRcdHRoaXMuaW5kaWNlc1tpICsgMl0gPSBqICsgMjtcblx0XHRcdHRoaXMuaW5kaWNlc1tpICsgM10gPSBqICsgMDtcblx0XHRcdHRoaXMuaW5kaWNlc1tpICsgNF0gPSBqICsgMjtcblx0XHRcdHRoaXMuaW5kaWNlc1tpICsgNV0gPSBqICsgMztcblx0XHR9XG5cblx0XHR2YXIgbWVzaCA9IG5ldyBNZXNoKHRoaXMuY29udGV4dCwgZmFsc2UsIFxuXHRcdFx0XHRcdFx0bnVtVmVydHMsIG51bUluZGljZXMsIHRoaXMuX2NyZWF0ZVZlcnRleEF0dHJpYnV0ZXMoKSk7XG5cdFx0bWVzaC52ZXJ0aWNlcyA9IHRoaXMudmVydGljZXM7XG5cdFx0bWVzaC5pbmRpY2VzID0gdGhpcy5pbmRpY2VzO1xuXHRcdG1lc2gudmVydGV4VXNhZ2UgPSBnbC5EWU5BTUlDX0RSQVc7XG5cdFx0bWVzaC5pbmRleFVzYWdlID0gZ2wuU1RBVElDX0RSQVc7XG5cdFx0bWVzaC5kaXJ0eSA9IHRydWU7XG5cdFx0cmV0dXJuIG1lc2g7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFJldHVybnMgYSBzaGFkZXIgZm9yIHRoaXMgYmF0Y2guIElmIHlvdSBwbGFuIHRvIHN1cHBvcnRcblx0ICogbXVsdGlwbGUgaW5zdGFuY2VzIG9mIHlvdXIgYmF0Y2gsIGl0IG1heSBvciBtYXkgbm90IGJlIHdpc2Vcblx0ICogdG8gdXNlIGEgc2hhcmVkIHNoYWRlciB0byBzYXZlIHJlc291cmNlcy5cblx0ICogXG5cdCAqIFRoaXMgbWV0aG9kIGluaXRpYWxseSB0aHJvd3MgYW4gZXJyb3I7IHNvIGl0IG11c3QgYmUgb3ZlcnJpZGRlbiBieVxuXHQgKiBzdWJjbGFzc2VzIG9mIEJhc2VCYXRjaC5cblx0ICpcblx0ICogQG1ldGhvZCAgX2NyZWF0ZVNoYWRlclxuXHQgKiBAcmV0dXJuIHtOdW1iZXJ9IHRoZSBzaXplIG9mIGEgdmVydGV4LCBpbiAjIG9mIGZsb2F0c1xuXHQgKi9cblx0X2NyZWF0ZVNoYWRlcjogZnVuY3Rpb24oKSB7XG5cdFx0dGhyb3cgXCJfY3JlYXRlU2hhZGVyIG5vdCBpbXBsZW1lbnRlZFwiXG5cdH0sXHRcblxuXHQvKipcblx0ICogUmV0dXJucyBhbiBhcnJheSBvZiB2ZXJ0ZXggYXR0cmlidXRlcyBmb3IgdGhpcyBtZXNoOyBcblx0ICogc3ViY2xhc3NlcyBzaG91bGQgaW1wbGVtZW50IHRoaXMgd2l0aCB0aGUgYXR0cmlidXRlcyBcblx0ICogZXhwZWN0ZWQgZm9yIHRoZWlyIGJhdGNoLlxuXHQgKlxuXHQgKiBUaGlzIG1ldGhvZCBpbml0aWFsbHkgdGhyb3dzIGFuIGVycm9yOyBzbyBpdCBtdXN0IGJlIG92ZXJyaWRkZW4gYnlcblx0ICogc3ViY2xhc3NlcyBvZiBCYXNlQmF0Y2guXG5cdCAqXG5cdCAqIEBtZXRob2QgX2NyZWF0ZVZlcnRleEF0dHJpYnV0ZXNcblx0ICogQHJldHVybiB7QXJyYXl9IGFuIGFycmF5IG9mIE1lc2guVmVydGV4QXR0cmliIG9iamVjdHNcblx0ICovXG5cdF9jcmVhdGVWZXJ0ZXhBdHRyaWJ1dGVzOiBmdW5jdGlvbigpIHtcblx0XHR0aHJvdyBcIl9jcmVhdGVWZXJ0ZXhBdHRyaWJ1dGVzIG5vdCBpbXBsZW1lbnRlZFwiO1xuXHR9LFxuXG5cblx0LyoqXG5cdCAqIFJldHVybnMgdGhlIG51bWJlciBvZiBmbG9hdHMgcGVyIHZlcnRleCBmb3IgdGhpcyBiYXRjaGVyLlxuXHQgKiBcblx0ICogVGhpcyBtZXRob2QgaW5pdGlhbGx5IHRocm93cyBhbiBlcnJvcjsgc28gaXQgbXVzdCBiZSBvdmVycmlkZGVuIGJ5XG5cdCAqIHN1YmNsYXNzZXMgb2YgQmFzZUJhdGNoLlxuXHQgKlxuXHQgKiBAbWV0aG9kICBnZXRWZXJ0ZXhTaXplXG5cdCAqIEByZXR1cm4ge051bWJlcn0gdGhlIHNpemUgb2YgYSB2ZXJ0ZXgsIGluICMgb2YgZmxvYXRzXG5cdCAqL1xuXHRnZXRWZXJ0ZXhTaXplOiBmdW5jdGlvbigpIHtcblx0XHR0aHJvdyBcImdldFZlcnRleFNpemUgbm90IGltcGxlbWVudGVkXCI7XG5cdH0sXG5cblx0XG5cdC8qKiBcblx0ICogQmVnaW5zIHRoZSBzcHJpdGUgYmF0Y2guIFRoaXMgd2lsbCBiaW5kIHRoZSBzaGFkZXJcblx0ICogYW5kIG1lc2guIFN1YmNsYXNzZXMgbWF5IHdhbnQgdG8gZGlzYWJsZSBkZXB0aCBvciBcblx0ICogc2V0IHVwIGJsZW5kaW5nLlxuXHQgKlxuXHQgKiBAbWV0aG9kICBiZWdpblxuXHQgKi9cblx0YmVnaW46IGZ1bmN0aW9uKCkgIHtcblx0XHRpZiAodGhpcy5kcmF3aW5nKSBcblx0XHRcdHRocm93IFwiYmF0Y2guZW5kKCkgbXVzdCBiZSBjYWxsZWQgYmVmb3JlIGJlZ2luXCI7XG5cdFx0dGhpcy5kcmF3aW5nID0gdHJ1ZTtcblxuXHRcdHRoaXMuc2hhZGVyLmJpbmQoKTtcblxuXHRcdC8vYmluZCB0aGUgYXR0cmlidXRlcyBub3cgdG8gYXZvaWQgcmVkdW5kYW50IGNhbGxzXG5cdFx0dGhpcy5tZXNoLmJpbmQodGhpcy5zaGFkZXIpO1xuXG5cdFx0aWYgKHRoaXMuX2JsZW5kaW5nRW5hYmxlZCkge1xuXHRcdFx0dmFyIGdsID0gdGhpcy5jb250ZXh0LmdsO1xuXHRcdFx0Z2wuZW5hYmxlKGdsLkJMRU5EKTtcblx0XHR9XG5cdH0sXG5cblx0LyoqIFxuXHQgKiBFbmRzIHRoZSBzcHJpdGUgYmF0Y2guIFRoaXMgd2lsbCBmbHVzaCBhbnkgcmVtYWluaW5nIFxuXHQgKiBkYXRhIGFuZCBzZXQgR0wgc3RhdGUgYmFjayB0byBub3JtYWwuXG5cdCAqIFxuXHQgKiBAbWV0aG9kICBlbmRcblx0ICovXG5cdGVuZDogZnVuY3Rpb24oKSAge1xuXHRcdGlmICghdGhpcy5kcmF3aW5nKVxuXHRcdFx0dGhyb3cgXCJiYXRjaC5iZWdpbigpIG11c3QgYmUgY2FsbGVkIGJlZm9yZSBlbmRcIjtcblx0XHRpZiAodGhpcy5pZHggPiAwKVxuXHRcdFx0dGhpcy5mbHVzaCgpO1xuXHRcdHRoaXMuZHJhd2luZyA9IGZhbHNlO1xuXG5cdFx0dGhpcy5tZXNoLnVuYmluZCh0aGlzLnNoYWRlcik7XG5cblx0XHRpZiAodGhpcy5fYmxlbmRpbmdFbmFibGVkKSB7XG5cdFx0XHR2YXIgZ2wgPSB0aGlzLmNvbnRleHQuZ2w7XG5cdFx0XHRnbC5kaXNhYmxlKGdsLkJMRU5EKTtcblx0XHR9XG5cdH0sXG5cblx0LyoqIFxuXHQgKiBDYWxsZWQgYmVmb3JlIHJlbmRlcmluZyB0byBiaW5kIG5ldyB0ZXh0dXJlcy5cblx0ICogVGhpcyBtZXRob2QgZG9lcyBub3RoaW5nIGJ5IGRlZmF1bHQuXG5cdCAqXG5cdCAqIEBtZXRob2QgIF9wcmVSZW5kZXJcblx0ICovXG5cdF9wcmVSZW5kZXI6IGZ1bmN0aW9uKCkgIHtcblx0fSxcblxuXHQvKipcblx0ICogRmx1c2hlcyB0aGUgYmF0Y2ggYnkgcHVzaGluZyB0aGUgY3VycmVudCBkYXRhXG5cdCAqIHRvIEdMLlxuXHQgKiBcblx0ICogQG1ldGhvZCBmbHVzaFxuXHQgKi9cblx0Zmx1c2g6IGZ1bmN0aW9uKCkgIHtcblx0XHRpZiAodGhpcy5pZHg9PT0wKVxuXHRcdFx0cmV0dXJuO1xuXG5cdFx0dmFyIGdsID0gdGhpcy5jb250ZXh0LmdsO1xuXG5cdFx0Ly9wcmVtdWx0aXBsaWVkIGFscGhhXG5cdFx0aWYgKHRoaXMuX2JsZW5kaW5nRW5hYmxlZCkge1xuXHRcdFx0Ly9zZXQgZWl0aGVyIHRvIG51bGwgaWYgeW91IHdhbnQgdG8gY2FsbCB5b3VyIG93biBcblx0XHRcdC8vYmxlbmRGdW5jIG9yIGJsZW5kRnVuY1NlcGFyYXRlXG5cdFx0XHRpZiAodGhpcy5fYmxlbmRTcmMgJiYgdGhpcy5fYmxlbmREc3QpXG5cdFx0XHRcdGdsLmJsZW5kRnVuYyh0aGlzLl9ibGVuZFNyYywgdGhpcy5fYmxlbmREc3QpOyBcblx0XHR9XG5cblx0XHR0aGlzLl9wcmVSZW5kZXIoKTtcblxuXHRcdC8vbnVtYmVyIG9mIHNwcml0ZXMgaW4gYmF0Y2hcblx0XHR2YXIgbnVtQ29tcG9uZW50cyA9IHRoaXMuZ2V0VmVydGV4U2l6ZSgpO1xuXHRcdHZhciBzcHJpdGVDb3VudCA9ICh0aGlzLmlkeCAvIChudW1Db21wb25lbnRzICogNCkpO1xuXHRcdFxuXHRcdC8vZHJhdyB0aGUgc3ByaXRlc1xuXHRcdHRoaXMubWVzaC52ZXJ0aWNlc0RpcnR5ID0gdHJ1ZTtcblx0XHR0aGlzLm1lc2guZHJhdyhnbC5UUklBTkdMRVMsIHNwcml0ZUNvdW50ICogNiwgMCwgdGhpcy5pZHgpO1xuXG5cdFx0dGhpcy5pZHggPSAwO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBBZGRzIGEgc3ByaXRlIHRvIHRoaXMgYmF0Y2guXG5cdCAqIFRoZSBzcGVjaWZpY3MgZGVwZW5kIG9uIHRoZSBzcHJpdGUgYmF0Y2ggaW1wbGVtZW50YXRpb24uXG5cdCAqXG5cdCAqIEBtZXRob2QgZHJhd1xuXHQgKiBAcGFyYW0gIHtUZXh0dXJlfSB0ZXh0dXJlIHRoZSB0ZXh0dXJlIGZvciB0aGlzIHNwcml0ZVxuXHQgKiBAcGFyYW0gIHtOdW1iZXJ9IHggICAgICAgdGhlIHggcG9zaXRpb24sIGRlZmF1bHRzIHRvIHplcm9cblx0ICogQHBhcmFtICB7TnVtYmVyfSB5ICAgICAgIHRoZSB5IHBvc2l0aW9uLCBkZWZhdWx0cyB0byB6ZXJvXG5cdCAqIEBwYXJhbSAge051bWJlcn0gd2lkdGggICB0aGUgd2lkdGgsIGRlZmF1bHRzIHRvIHRoZSB0ZXh0dXJlIHdpZHRoXG5cdCAqIEBwYXJhbSAge051bWJlcn0gaGVpZ2h0ICB0aGUgaGVpZ2h0LCBkZWZhdWx0cyB0byB0aGUgdGV4dHVyZSBoZWlnaHRcblx0ICogQHBhcmFtICB7TnVtYmVyfSB1MSAgICAgIHRoZSBmaXJzdCBVIGNvb3JkaW5hdGUsIGRlZmF1bHQgemVyb1xuXHQgKiBAcGFyYW0gIHtOdW1iZXJ9IHYxICAgICAgdGhlIGZpcnN0IFYgY29vcmRpbmF0ZSwgZGVmYXVsdCB6ZXJvXG5cdCAqIEBwYXJhbSAge051bWJlcn0gdTIgICAgICB0aGUgc2Vjb25kIFUgY29vcmRpbmF0ZSwgZGVmYXVsdCBvbmVcblx0ICogQHBhcmFtICB7TnVtYmVyfSB2MiAgICAgIHRoZSBzZWNvbmQgViBjb29yZGluYXRlLCBkZWZhdWx0IG9uZVxuXHQgKi9cblx0ZHJhdzogZnVuY3Rpb24odGV4dHVyZSwgeCwgeSwgd2lkdGgsIGhlaWdodCwgdTEsIHYxLCB1MiwgdjIpIHtcblx0fSxcblxuXHQvKipcblx0ICogQWRkcyBhIHNpbmdsZSBxdWFkIG1lc2ggdG8gdGhpcyBzcHJpdGUgYmF0Y2ggZnJvbSB0aGUgZ2l2ZW5cblx0ICogYXJyYXkgb2YgdmVydGljZXMuXG5cdCAqIFRoZSBzcGVjaWZpY3MgZGVwZW5kIG9uIHRoZSBzcHJpdGUgYmF0Y2ggaW1wbGVtZW50YXRpb24uXG5cdCAqXG5cdCAqIEBtZXRob2QgIGRyYXdWZXJ0aWNlc1xuXHQgKiBAcGFyYW0ge1RleHR1cmV9IHRleHR1cmUgdGhlIHRleHR1cmUgd2UgYXJlIGRyYXdpbmcgZm9yIHRoaXMgc3ByaXRlXG5cdCAqIEBwYXJhbSB7RmxvYXQzMkFycmF5fSB2ZXJ0cyBhbiBhcnJheSBvZiB2ZXJ0aWNlc1xuXHQgKiBAcGFyYW0ge051bWJlcn0gb2ZmIHRoZSBvZmZzZXQgaW50byB0aGUgdmVydGljZXMgYXJyYXkgdG8gcmVhZCBmcm9tXG5cdCAqL1xuXHRkcmF3VmVydGljZXM6IGZ1bmN0aW9uKHRleHR1cmUsIHZlcnRzLCBvZmYpICB7XG5cdH0sXG5cblx0ZHJhd1JlZ2lvbjogZnVuY3Rpb24ocmVnaW9uLCB4LCB5LCB3aWR0aCwgaGVpZ2h0KSB7XG5cdFx0dGhpcy5kcmF3KHJlZ2lvbi50ZXh0dXJlLCB4LCB5LCB3aWR0aCwgaGVpZ2h0LCByZWdpb24udSwgcmVnaW9uLnYsIHJlZ2lvbi51MiwgcmVnaW9uLnYyKTtcblx0fSxcblxuXHQvKipcblx0ICogRGVzdHJveXMgdGhlIGJhdGNoLCBkZWxldGluZyBpdHMgYnVmZmVycyBhbmQgcmVtb3ZpbmcgaXQgZnJvbSB0aGVcblx0ICogV2ViR0xDb250ZXh0IG1hbmFnZW1lbnQuIFRyeWluZyB0byB1c2UgdGhpc1xuXHQgKiBiYXRjaCBhZnRlciBkZXN0cm95aW5nIGl0IGNhbiBsZWFkIHRvIHVucHJlZGljdGFibGUgYmVoYXZpb3VyLlxuXHQgKlxuXHQgKiBJZiBgb3duc1NoYWRlcmAgaXMgdHJ1ZSwgdGhpcyB3aWxsIGFsc28gZGVsZXRlIHRoZSBgZGVmYXVsdFNoYWRlcmAgb2JqZWN0LlxuXHQgKiBcblx0ICogQG1ldGhvZCBkZXN0cm95XG5cdCAqL1xuXHRkZXN0cm95OiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLnZlcnRpY2VzID0gbnVsbDtcblx0XHR0aGlzLmluZGljZXMgPSBudWxsO1xuXHRcdHRoaXMuc2l6ZSA9IHRoaXMubWF4VmVydGljZXMgPSAwO1xuXG5cdFx0aWYgKHRoaXMub3duc1NoYWRlciAmJiB0aGlzLmRlZmF1bHRTaGFkZXIpXG5cdFx0XHR0aGlzLmRlZmF1bHRTaGFkZXIuZGVzdHJveSgpO1xuXHRcdHRoaXMuZGVmYXVsdFNoYWRlciA9IG51bGw7XG5cdFx0dGhpcy5fc2hhZGVyID0gbnVsbDsgLy8gcmVtb3ZlIHJlZmVyZW5jZSB0byB3aGF0ZXZlciBzaGFkZXIgaXMgY3VycmVudGx5IGJlaW5nIHVzZWRcblxuXHRcdGlmICh0aGlzLm1lc2gpIFxuXHRcdFx0dGhpcy5tZXNoLmRlc3Ryb3koKTtcblx0XHR0aGlzLm1lc2ggPSBudWxsO1xuXHR9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBCYXNlQmF0Y2g7XG4iLCIvKipcbiAqIEBtb2R1bGUga2FtaVxuICovXG5cbi8vIFJlcXVpcmVzLi4uLlxudmFyIENsYXNzICAgICAgICAgPSByZXF1aXJlKCdrbGFzc2UnKTtcblxudmFyIEJhc2VCYXRjaCA9IHJlcXVpcmUoJy4vQmFzZUJhdGNoJyk7XG5cbnZhciBNZXNoICAgICAgICAgID0gcmVxdWlyZSgnLi9nbHV0aWxzL01lc2gnKTtcbnZhciBTaGFkZXJQcm9ncmFtID0gcmVxdWlyZSgnLi9nbHV0aWxzL1NoYWRlclByb2dyYW0nKTtcblxuLyoqXG4gKiBBIGJhc2ljIGltcGxlbWVudGF0aW9uIG9mIGEgYmF0Y2hlciB3aGljaCBkcmF3cyAyRCBzcHJpdGVzLlxuICogVGhpcyB1c2VzIHR3byB0cmlhbmdsZXMgKHF1YWRzKSB3aXRoIGluZGV4ZWQgYW5kIGludGVybGVhdmVkXG4gKiB2ZXJ0ZXggZGF0YS4gRWFjaCB2ZXJ0ZXggaG9sZHMgNSBmbG9hdHMgKFBvc2l0aW9uLnh5LCBDb2xvciwgVGV4Q29vcmQwLnh5KS5cbiAqXG4gKiBUaGUgY29sb3IgaXMgcGFja2VkIGludG8gYSBzaW5nbGUgZmxvYXQgdG8gcmVkdWNlIHZlcnRleCBiYW5kd2lkdGgsIGFuZFxuICogdGhlIGRhdGEgaXMgaW50ZXJsZWF2ZWQgZm9yIGJlc3QgcGVyZm9ybWFuY2UuIFdlIHVzZSBhIHN0YXRpYyBpbmRleCBidWZmZXIsXG4gKiBhbmQgYSBkeW5hbWljIHZlcnRleCBidWZmZXIgdGhhdCBpcyB1cGRhdGVkIHdpdGggYnVmZmVyU3ViRGF0YS4gXG4gKiBcbiAqIEBleGFtcGxlXG4gKiAgICAgIHZhciBTcHJpdGVCYXRjaCA9IHJlcXVpcmUoJ2thbWknKS5TcHJpdGVCYXRjaDsgIFxuICogICAgICBcbiAqICAgICAgLy9jcmVhdGUgYSBuZXcgYmF0Y2hlclxuICogICAgICB2YXIgYmF0Y2ggPSBuZXcgU3ByaXRlQmF0Y2goY29udGV4dCk7XG4gKlxuICogICAgICBmdW5jdGlvbiByZW5kZXIoKSB7XG4gKiAgICAgICAgICBiYXRjaC5iZWdpbigpO1xuICogICAgICAgICAgXG4gKiAgICAgICAgICAvL2RyYXcgc29tZSBzcHJpdGVzIGluIGJldHdlZW4gYmVnaW4gYW5kIGVuZC4uLlxuICogICAgICAgICAgYmF0Y2guZHJhdyggdGV4dHVyZSwgMCwgMCwgMjUsIDMyICk7XG4gKiAgICAgICAgICBiYXRjaC5kcmF3KCB0ZXh0dXJlMSwgMCwgMjUsIDQyLCAyMyApO1xuICogXG4gKiAgICAgICAgICBiYXRjaC5lbmQoKTtcbiAqICAgICAgfVxuICogXG4gKiBAY2xhc3MgIFNwcml0ZUJhdGNoXG4gKiBAdXNlcyBCYXNlQmF0Y2hcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHtXZWJHTENvbnRleHR9IGNvbnRleHQgdGhlIGNvbnRleHQgZm9yIHRoaXMgYmF0Y2hcbiAqIEBwYXJhbSB7TnVtYmVyfSBzaXplIHRoZSBtYXggbnVtYmVyIG9mIHNwcml0ZXMgdG8gZml0IGluIGEgc2luZ2xlIGJhdGNoXG4gKi9cbnZhciBTcHJpdGVCYXRjaCA9IG5ldyBDbGFzcyh7XG5cblx0Ly9pbmhlcml0IHNvbWUgc3R1ZmYgb250byB0aGlzIHByb3RvdHlwZVxuXHRNaXhpbnM6IEJhc2VCYXRjaCxcblxuXHQvL0NvbnN0cnVjdG9yXG5cdGluaXRpYWxpemU6IGZ1bmN0aW9uIFNwcml0ZUJhdGNoKGNvbnRleHQsIHNpemUpIHtcblx0XHRCYXNlQmF0Y2guY2FsbCh0aGlzLCBjb250ZXh0LCBzaXplKTtcblxuXHRcdC8qKlxuXHRcdCAqIFRoZSBwcm9qZWN0aW9uIEZsb2F0MzJBcnJheSB2ZWMyIHdoaWNoIGlzXG5cdFx0ICogdXNlZCB0byBhdm9pZCBzb21lIG1hdHJpeCBjYWxjdWxhdGlvbnMuXG5cdFx0ICpcblx0XHQgKiBAcHJvcGVydHkgcHJvamVjdGlvblxuXHRcdCAqIEB0eXBlIHtGbG9hdDMyQXJyYXl9XG5cdFx0ICovXG5cdFx0dGhpcy5wcm9qZWN0aW9uID0gbmV3IEZsb2F0MzJBcnJheSgyKTtcblxuXHRcdC8vU2V0cyB1cCBhIGRlZmF1bHQgcHJvamVjdGlvbiB2ZWN0b3Igc28gdGhhdCB0aGUgYmF0Y2ggd29ya3Mgd2l0aG91dCBzZXRQcm9qZWN0aW9uXG5cdFx0dGhpcy5wcm9qZWN0aW9uWzBdID0gdGhpcy5jb250ZXh0LndpZHRoLzI7XG5cdFx0dGhpcy5wcm9qZWN0aW9uWzFdID0gdGhpcy5jb250ZXh0LmhlaWdodC8yO1xuXG5cdFx0LyoqXG5cdFx0ICogVGhlIGN1cnJlbnRseSBib3VuZCB0ZXh0dXJlLiBEbyBub3QgbW9kaWZ5LlxuXHRcdCAqIFxuXHRcdCAqIEBwcm9wZXJ0eSB7VGV4dHVyZX0gdGV4dHVyZVxuXHRcdCAqIEByZWFkT25seVxuXHRcdCAqL1xuXHRcdHRoaXMudGV4dHVyZSA9IG51bGw7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFRoaXMgaXMgYSBjb252ZW5pZW5jZSBmdW5jdGlvbiB0byBzZXQgdGhlIGJhdGNoJ3MgcHJvamVjdGlvblxuXHQgKiBtYXRyaXggdG8gYW4gb3J0aG9ncmFwaGljIDJEIHByb2plY3Rpb24sIGJhc2VkIG9uIHRoZSBnaXZlbiBzY3JlZW5cblx0ICogc2l6ZS4gVGhpcyBhbGxvd3MgdXNlcnMgdG8gcmVuZGVyIGluIDJEIHdpdGhvdXQgYW55IG5lZWQgZm9yIGEgY2FtZXJhLlxuXHQgKiBcblx0ICogQHBhcmFtICB7W3R5cGVdfSB3aWR0aCAgW2Rlc2NyaXB0aW9uXVxuXHQgKiBAcGFyYW0gIHtbdHlwZV19IGhlaWdodCBbZGVzY3JpcHRpb25dXG5cdCAqIEByZXR1cm4ge1t0eXBlXX0gICAgICAgIFtkZXNjcmlwdGlvbl1cblx0ICovXG5cdHJlc2l6ZTogZnVuY3Rpb24od2lkdGgsIGhlaWdodCkge1xuXHRcdHRoaXMuc2V0UHJvamVjdGlvbih3aWR0aC8yLCBoZWlnaHQvMik7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFRoZSBudW1iZXIgb2YgZmxvYXRzIHBlciB2ZXJ0ZXggZm9yIHRoaXMgYmF0Y2hlciBcblx0ICogKFBvc2l0aW9uLnh5ICsgQ29sb3IgKyBUZXhDb29yZDAueHkpLlxuXHQgKlxuXHQgKiBAbWV0aG9kICBnZXRWZXJ0ZXhTaXplXG5cdCAqIEByZXR1cm4ge051bWJlcn0gdGhlIG51bWJlciBvZiBmbG9hdHMgcGVyIHZlcnRleFxuXHQgKi9cblx0Z2V0VmVydGV4U2l6ZTogZnVuY3Rpb24oKSB7XG5cdFx0cmV0dXJuIFNwcml0ZUJhdGNoLlZFUlRFWF9TSVpFO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBVc2VkIGludGVybmFsbHkgdG8gcmV0dXJuIHRoZSBQb3NpdGlvbiwgQ29sb3IsIGFuZCBUZXhDb29yZDAgYXR0cmlidXRlcy5cblx0ICpcblx0ICogQG1ldGhvZCAgX2NyZWF0ZVZlcnRleEF0dHJpYnVldHNcblx0ICogQHByb3RlY3RlZFxuXHQgKiBAcmV0dXJuIHtbdHlwZV19IFtkZXNjcmlwdGlvbl1cblx0ICovXG5cdF9jcmVhdGVWZXJ0ZXhBdHRyaWJ1dGVzOiBmdW5jdGlvbigpIHtcblx0XHR2YXIgZ2wgPSB0aGlzLmNvbnRleHQuZ2w7XG5cblx0XHRyZXR1cm4gWyBcblx0XHRcdG5ldyBNZXNoLkF0dHJpYihTaGFkZXJQcm9ncmFtLlBPU0lUSU9OX0FUVFJJQlVURSwgMiksXG5cdFx0XHQgLy9wYWNrIHRoZSBjb2xvciB1c2luZyBzb21lIGNyYXp5IHdpemFyZHJ5IFxuXHRcdFx0bmV3IE1lc2guQXR0cmliKFNoYWRlclByb2dyYW0uQ09MT1JfQVRUUklCVVRFLCA0LCBudWxsLCBnbC5VTlNJR05FRF9CWVRFLCB0cnVlLCAxKSxcblx0XHRcdG5ldyBNZXNoLkF0dHJpYihTaGFkZXJQcm9ncmFtLlRFWENPT1JEX0FUVFJJQlVURStcIjBcIiwgMilcblx0XHRdO1xuXHR9LFxuXG5cblx0LyoqXG5cdCAqIFNldHMgdGhlIHByb2plY3Rpb24gdmVjdG9yLCBhbiB4IGFuZCB5XG5cdCAqIGRlZmluaW5nIHRoZSBtaWRkbGUgcG9pbnRzIG9mIHlvdXIgc3RhZ2UuXG5cdCAqXG5cdCAqIEBtZXRob2Qgc2V0UHJvamVjdGlvblxuXHQgKiBAcGFyYW0ge051bWJlcn0geCB0aGUgeCBwcm9qZWN0aW9uIHZhbHVlXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSB5IHRoZSB5IHByb2plY3Rpb24gdmFsdWVcblx0ICovXG5cdHNldFByb2plY3Rpb246IGZ1bmN0aW9uKHgsIHkpIHtcblx0XHR2YXIgb2xkWCA9IHRoaXMucHJvamVjdGlvblswXTtcblx0XHR2YXIgb2xkWSA9IHRoaXMucHJvamVjdGlvblsxXTtcblx0XHR0aGlzLnByb2plY3Rpb25bMF0gPSB4O1xuXHRcdHRoaXMucHJvamVjdGlvblsxXSA9IHk7XG5cblx0XHQvL3dlIG5lZWQgdG8gZmx1c2ggdGhlIGJhdGNoLi5cblx0XHRpZiAodGhpcy5kcmF3aW5nICYmICh4ICE9IG9sZFggfHwgeSAhPSBvbGRZKSkge1xuXHRcdFx0dGhpcy5mbHVzaCgpO1xuXHRcdFx0dGhpcy5fdXBkYXRlTWF0cmljZXMoKTtcblx0XHR9XG5cdH0sXG5cblx0LyoqXG5cdCAqIENyZWF0ZXMgYSBkZWZhdWx0IHNoYWRlciBmb3IgdGhpcyBiYXRjaC5cblx0ICpcblx0ICogQG1ldGhvZCAgX2NyZWF0ZVNoYWRlclxuXHQgKiBAcHJvdGVjdGVkXG5cdCAqIEByZXR1cm4ge1NoYWRlclByb2dyYW19IGEgbmV3IGluc3RhbmNlIG9mIFNoYWRlclByb2dyYW1cblx0ICovXG5cdF9jcmVhdGVTaGFkZXI6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBzaGFkZXIgPSBuZXcgU2hhZGVyUHJvZ3JhbSh0aGlzLmNvbnRleHQsXG5cdFx0XHRcdFNwcml0ZUJhdGNoLkRFRkFVTFRfVkVSVF9TSEFERVIsIFxuXHRcdFx0XHRTcHJpdGVCYXRjaC5ERUZBVUxUX0ZSQUdfU0hBREVSKTtcblx0XHRpZiAoc2hhZGVyLmxvZylcblx0XHRcdGNvbnNvbGUud2FybihcIlNoYWRlciBMb2c6XFxuXCIgKyBzaGFkZXIubG9nKTtcblx0XHRyZXR1cm4gc2hhZGVyO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBUaGlzIGlzIGNhbGxlZCBkdXJpbmcgcmVuZGVyaW5nIHRvIHVwZGF0ZSBwcm9qZWN0aW9uL3RyYW5zZm9ybVxuXHQgKiBtYXRyaWNlcyBhbmQgdXBsb2FkIHRoZSBuZXcgdmFsdWVzIHRvIHRoZSBzaGFkZXIuIEZvciBleGFtcGxlLFxuXHQgKiBpZiB0aGUgdXNlciBjYWxscyBzZXRQcm9qZWN0aW9uIG1pZC1kcmF3LCB0aGUgYmF0Y2ggd2lsbCBmbHVzaFxuXHQgKiBhbmQgdGhpcyB3aWxsIGJlIGNhbGxlZCBiZWZvcmUgY29udGludWluZyB0byBhZGQgaXRlbXMgdG8gdGhlIGJhdGNoLlxuXHQgKlxuXHQgKiBZb3UgZ2VuZXJhbGx5IHNob3VsZCBub3QgbmVlZCB0byBjYWxsIHRoaXMgZGlyZWN0bHkuXG5cdCAqIFxuXHQgKiBAbWV0aG9kICB1cGRhdGVNYXRyaWNlc1xuXHQgKiBAcHJvdGVjdGVkXG5cdCAqL1xuXHR1cGRhdGVNYXRyaWNlczogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5zaGFkZXIuc2V0VW5pZm9ybWZ2KFwidV9wcm9qZWN0aW9uXCIsIHRoaXMucHJvamVjdGlvbik7XG5cdH0sXG5cblx0LyoqXG5cdCAqIENhbGxlZCBiZWZvcmUgcmVuZGVyaW5nLCBhbmQgYmluZHMgdGhlIGN1cnJlbnQgdGV4dHVyZS5cblx0ICogXG5cdCAqIEBtZXRob2QgX3ByZVJlbmRlclxuXHQgKiBAcHJvdGVjdGVkXG5cdCAqL1xuXHRfcHJlUmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHRpZiAodGhpcy50ZXh0dXJlKVxuXHRcdFx0dGhpcy50ZXh0dXJlLmJpbmQoKTtcblx0fSxcblxuXHQvKipcblx0ICogQmluZHMgdGhlIHNoYWRlciwgZGlzYWJsZXMgZGVwdGggd3JpdGluZywgXG5cdCAqIGVuYWJsZXMgYmxlbmRpbmcsIGFjdGl2YXRlcyB0ZXh0dXJlIHVuaXQgMCwgYW5kIHNlbmRzXG5cdCAqIGRlZmF1bHQgbWF0cmljZXMgYW5kIHNhbXBsZXIyRCB1bmlmb3JtcyB0byB0aGUgc2hhZGVyLlxuXHQgKlxuXHQgKiBAbWV0aG9kICBiZWdpblxuXHQgKi9cblx0YmVnaW46IGZ1bmN0aW9uKCkge1xuXHRcdC8vc3ByaXRlIGJhdGNoIGRvZXNuJ3QgaG9sZCBhIHJlZmVyZW5jZSB0byBHTCBzaW5jZSBpdCBpcyB2b2xhdGlsZVxuXHRcdHZhciBnbCA9IHRoaXMuY29udGV4dC5nbDtcblx0XHRcblx0XHQvL1RoaXMgYmluZHMgdGhlIHNoYWRlciBhbmQgbWVzaCFcblx0XHRCYXNlQmF0Y2gucHJvdG90eXBlLmJlZ2luLmNhbGwodGhpcyk7XG5cblx0XHR0aGlzLnVwZGF0ZU1hdHJpY2VzKCk7IC8vc2VuZCBwcm9qZWN0aW9uL3RyYW5zZm9ybSB0byBzaGFkZXJcblxuXHRcdC8vdXBsb2FkIHRoZSBzYW1wbGVyIHVuaWZvcm0uIG5vdCBuZWNlc3NhcnkgZXZlcnkgZmx1c2ggc28gd2UganVzdFxuXHRcdC8vZG8gaXQgaGVyZS5cblx0XHR0aGlzLnNoYWRlci5zZXRVbmlmb3JtaShcInVfdGV4dHVyZTBcIiwgMCk7XG5cblx0XHQvL2Rpc2FibGUgZGVwdGggbWFza1xuXHRcdGdsLmRlcHRoTWFzayhmYWxzZSk7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEVuZHMgdGhlIHNwcml0ZSBiYXRjaGVyIGFuZCBmbHVzaGVzIGFueSByZW1haW5pbmcgZGF0YSB0byB0aGUgR1BVLlxuXHQgKiBcblx0ICogQG1ldGhvZCBlbmRcblx0ICovXG5cdGVuZDogZnVuY3Rpb24oKSB7XG5cdFx0Ly9zcHJpdGUgYmF0Y2ggZG9lc24ndCBob2xkIGEgcmVmZXJlbmNlIHRvIEdMIHNpbmNlIGl0IGlzIHZvbGF0aWxlXG5cdFx0dmFyIGdsID0gdGhpcy5jb250ZXh0LmdsO1xuXHRcdFxuXHRcdC8vanVzdCBkbyBkaXJlY3QgcGFyZW50IGNhbGwgZm9yIHNwZWVkIGhlcmVcblx0XHQvL1RoaXMgYmluZHMgdGhlIHNoYWRlciBhbmQgbWVzaCFcblx0XHRCYXNlQmF0Y2gucHJvdG90eXBlLmVuZC5jYWxsKHRoaXMpO1xuXG5cdFx0Z2wuZGVwdGhNYXNrKHRydWUpO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBGbHVzaGVzIHRoZSBiYXRjaCB0byB0aGUgR1BVLiBUaGlzIHNob3VsZCBiZSBjYWxsZWQgd2hlblxuXHQgKiBzdGF0ZSBjaGFuZ2VzLCBzdWNoIGFzIGJsZW5kIGZ1bmN0aW9ucywgZGVwdGggb3Igc3RlbmNpbCBzdGF0ZXMsXG5cdCAqIHNoYWRlcnMsIGFuZCBzbyBmb3J0aC5cblx0ICogXG5cdCAqIEBtZXRob2QgZmx1c2hcblx0ICovXG5cdGZsdXNoOiBmdW5jdGlvbigpIHtcblx0XHQvL2lnbm9yZSBmbHVzaCBpZiB0ZXh0dXJlIGlzIG51bGwgb3Igb3VyIGJhdGNoIGlzIGVtcHR5XG5cdFx0aWYgKCF0aGlzLnRleHR1cmUpXG5cdFx0XHRyZXR1cm47XG5cdFx0aWYgKHRoaXMuaWR4ID09PSAwKVxuXHRcdFx0cmV0dXJuO1xuXHRcdEJhc2VCYXRjaC5wcm90b3R5cGUuZmx1c2guY2FsbCh0aGlzKTtcblx0XHRTcHJpdGVCYXRjaC50b3RhbFJlbmRlckNhbGxzKys7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEFkZHMgYSBzcHJpdGUgdG8gdGhpcyBiYXRjaC4gVGhlIHNwcml0ZSBpcyBkcmF3biBpbiBcblx0ICogc2NyZWVuLXNwYWNlIHdpdGggdGhlIG9yaWdpbiBhdCB0aGUgdXBwZXItbGVmdCBjb3JuZXIgKHktZG93bikuXG5cdCAqIFxuXHQgKiBAbWV0aG9kIGRyYXdcblx0ICogQHBhcmFtICB7VGV4dHVyZX0gdGV4dHVyZSB0aGUgVGV4dHVyZVxuXHQgKiBAcGFyYW0gIHtOdW1iZXJ9IHggICAgICAgdGhlIHggcG9zaXRpb24gaW4gcGl4ZWxzLCBkZWZhdWx0cyB0byB6ZXJvXG5cdCAqIEBwYXJhbSAge051bWJlcn0geSAgICAgICB0aGUgeSBwb3NpdGlvbiBpbiBwaXhlbHMsIGRlZmF1bHRzIHRvIHplcm9cblx0ICogQHBhcmFtICB7TnVtYmVyfSB3aWR0aCAgIHRoZSB3aWR0aCBpbiBwaXhlbHMsIGRlZmF1bHRzIHRvIHRoZSB0ZXh0dXJlIHdpZHRoXG5cdCAqIEBwYXJhbSAge051bWJlcn0gaGVpZ2h0ICB0aGUgaGVpZ2h0IGluIHBpeGVscywgZGVmYXVsdHMgdG8gdGhlIHRleHR1cmUgaGVpZ2h0XG5cdCAqIEBwYXJhbSAge051bWJlcn0gdTEgICAgICB0aGUgZmlyc3QgVSBjb29yZGluYXRlLCBkZWZhdWx0IHplcm9cblx0ICogQHBhcmFtICB7TnVtYmVyfSB2MSAgICAgIHRoZSBmaXJzdCBWIGNvb3JkaW5hdGUsIGRlZmF1bHQgemVyb1xuXHQgKiBAcGFyYW0gIHtOdW1iZXJ9IHUyICAgICAgdGhlIHNlY29uZCBVIGNvb3JkaW5hdGUsIGRlZmF1bHQgb25lXG5cdCAqIEBwYXJhbSAge051bWJlcn0gdjIgICAgICB0aGUgc2Vjb25kIFYgY29vcmRpbmF0ZSwgZGVmYXVsdCBvbmVcblx0ICovXG5cdGRyYXc6IGZ1bmN0aW9uKHRleHR1cmUsIHgsIHksIHdpZHRoLCBoZWlnaHQsIHUxLCB2MSwgdTIsIHYyKSB7XG5cdFx0aWYgKCF0aGlzLmRyYXdpbmcpXG5cdFx0XHR0aHJvdyBcIklsbGVnYWwgU3RhdGU6IHRyeWluZyB0byBkcmF3IGEgYmF0Y2ggYmVmb3JlIGJlZ2luKClcIjtcblxuXHRcdC8vZG9uJ3QgZHJhdyBhbnl0aGluZyBpZiBHTCB0ZXggZG9lc24ndCBleGlzdC4uXG5cdFx0aWYgKCF0ZXh0dXJlKVxuXHRcdFx0cmV0dXJuO1xuXG5cdFx0aWYgKHRoaXMudGV4dHVyZSA9PT0gbnVsbCB8fCB0aGlzLnRleHR1cmUuaWQgIT09IHRleHR1cmUuaWQpIHtcblx0XHRcdC8vbmV3IHRleHR1cmUuLiBmbHVzaCBwcmV2aW91cyBkYXRhXG5cdFx0XHR0aGlzLmZsdXNoKCk7XG5cdFx0XHR0aGlzLnRleHR1cmUgPSB0ZXh0dXJlO1xuXHRcdH0gZWxzZSBpZiAodGhpcy5pZHggPT0gdGhpcy52ZXJ0aWNlcy5sZW5ndGgpIHtcblx0XHRcdHRoaXMuZmx1c2goKTsgLy93ZSd2ZSByZWFjaGVkIG91ciBtYXgsIGZsdXNoIGJlZm9yZSBwdXNoaW5nIG1vcmUgZGF0YVxuXHRcdH1cblxuXHRcdHdpZHRoID0gKHdpZHRoPT09MCkgPyB3aWR0aCA6ICh3aWR0aCB8fCB0ZXh0dXJlLndpZHRoKTtcblx0XHRoZWlnaHQgPSAoaGVpZ2h0PT09MCkgPyBoZWlnaHQgOiAoaGVpZ2h0IHx8IHRleHR1cmUuaGVpZ2h0KTtcblx0XHR4ID0geCB8fCAwO1xuXHRcdHkgPSB5IHx8IDA7XG5cblx0XHR2YXIgeDEgPSB4O1xuXHRcdHZhciB4MiA9IHggKyB3aWR0aDtcblx0XHR2YXIgeTEgPSB5O1xuXHRcdHZhciB5MiA9IHkgKyBoZWlnaHQ7XG5cblx0XHR1MSA9IHUxIHx8IDA7XG5cdFx0dTIgPSAodTI9PT0wKSA/IHUyIDogKHUyIHx8IDEpO1xuXHRcdHYxID0gdjEgfHwgMDtcblx0XHR2MiA9ICh2Mj09PTApID8gdjIgOiAodjIgfHwgMSk7XG5cblx0XHR2YXIgYyA9IHRoaXMuY29sb3I7XG5cblx0XHQvL3h5XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHgxO1xuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB5MTtcblx0XHQvL2NvbG9yXG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IGM7XG5cdFx0Ly91dlxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB1MTtcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0gdjE7XG5cdFx0XG5cdFx0Ly94eVxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB4Mjtcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0geTE7XG5cdFx0Ly9jb2xvclxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSBjO1xuXHRcdC8vdXZcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0gdTI7XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHYxO1xuXG5cdFx0Ly94eVxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB4Mjtcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0geTI7XG5cdFx0Ly9jb2xvclxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSBjO1xuXHRcdC8vdXZcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0gdTI7XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHYyO1xuXG5cdFx0Ly94eVxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB4MTtcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0geTI7XG5cdFx0Ly9jb2xvclxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSBjO1xuXHRcdC8vdXZcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0gdTE7XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHYyO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBBZGRzIGEgc2luZ2xlIHF1YWQgbWVzaCB0byB0aGlzIHNwcml0ZSBiYXRjaCBmcm9tIHRoZSBnaXZlblxuXHQgKiBhcnJheSBvZiB2ZXJ0aWNlcy4gVGhlIHNwcml0ZSBpcyBkcmF3biBpbiBcblx0ICogc2NyZWVuLXNwYWNlIHdpdGggdGhlIG9yaWdpbiBhdCB0aGUgdXBwZXItbGVmdCBjb3JuZXIgKHktZG93bikuXG5cdCAqXG5cdCAqIFRoaXMgcmVhZHMgMjAgaW50ZXJsZWF2ZWQgZmxvYXRzIGZyb20gdGhlIGdpdmVuIG9mZnNldCBpbmRleCwgaW4gdGhlIGZvcm1hdFxuXHQgKlxuXHQgKiAgeyB4LCB5LCBjb2xvciwgdSwgdixcblx0ICogICAgICAuLi4gIH1cblx0ICpcblx0ICogQG1ldGhvZCAgZHJhd1ZlcnRpY2VzXG5cdCAqIEBwYXJhbSB7VGV4dHVyZX0gdGV4dHVyZSB0aGUgVGV4dHVyZSBvYmplY3Rcblx0ICogQHBhcmFtIHtGbG9hdDMyQXJyYXl9IHZlcnRzIGFuIGFycmF5IG9mIHZlcnRpY2VzXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBvZmYgdGhlIG9mZnNldCBpbnRvIHRoZSB2ZXJ0aWNlcyBhcnJheSB0byByZWFkIGZyb21cblx0ICovXG5cdGRyYXdWZXJ0aWNlczogZnVuY3Rpb24odGV4dHVyZSwgdmVydHMsIG9mZikge1xuXHRcdGlmICghdGhpcy5kcmF3aW5nKVxuXHRcdFx0dGhyb3cgXCJJbGxlZ2FsIFN0YXRlOiB0cnlpbmcgdG8gZHJhdyBhIGJhdGNoIGJlZm9yZSBiZWdpbigpXCI7XG5cdFx0XG5cdFx0Ly9kb24ndCBkcmF3IGFueXRoaW5nIGlmIEdMIHRleCBkb2Vzbid0IGV4aXN0Li5cblx0XHRpZiAoIXRleHR1cmUpXG5cdFx0XHRyZXR1cm47XG5cblxuXHRcdGlmICh0aGlzLnRleHR1cmUgIT0gdGV4dHVyZSkge1xuXHRcdFx0Ly9uZXcgdGV4dHVyZS4uIGZsdXNoIHByZXZpb3VzIGRhdGFcblx0XHRcdHRoaXMuZmx1c2goKTtcblx0XHRcdHRoaXMudGV4dHVyZSA9IHRleHR1cmU7XG5cdFx0fSBlbHNlIGlmICh0aGlzLmlkeCA9PSB0aGlzLnZlcnRpY2VzLmxlbmd0aCkge1xuXHRcdFx0dGhpcy5mbHVzaCgpOyAvL3dlJ3ZlIHJlYWNoZWQgb3VyIG1heCwgZmx1c2ggYmVmb3JlIHB1c2hpbmcgbW9yZSBkYXRhXG5cdFx0fVxuXG5cdFx0b2ZmID0gb2ZmIHx8IDA7XG5cdFx0Ly9UT0RPOiB1c2UgYSBsb29wIGhlcmU/XG5cdFx0Ly94eVxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB2ZXJ0c1tvZmYrK107XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHZlcnRzW29mZisrXTtcblx0XHQvL2NvbG9yXG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHZlcnRzW29mZisrXTtcblx0XHQvL3V2XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHZlcnRzW29mZisrXTtcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0gdmVydHNbb2ZmKytdO1xuXHRcdFxuXHRcdC8veHlcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0gdmVydHNbb2ZmKytdO1xuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB2ZXJ0c1tvZmYrK107XG5cdFx0Ly9jb2xvclxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB2ZXJ0c1tvZmYrK107XG5cdFx0Ly91dlxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB2ZXJ0c1tvZmYrK107XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHZlcnRzW29mZisrXTtcblxuXHRcdC8veHlcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0gdmVydHNbb2ZmKytdO1xuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB2ZXJ0c1tvZmYrK107XG5cdFx0Ly9jb2xvclxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB2ZXJ0c1tvZmYrK107XG5cdFx0Ly91dlxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB2ZXJ0c1tvZmYrK107XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHZlcnRzW29mZisrXTtcblxuXHRcdC8veHlcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0gdmVydHNbb2ZmKytdO1xuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB2ZXJ0c1tvZmYrK107XG5cdFx0Ly9jb2xvclxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB2ZXJ0c1tvZmYrK107XG5cdFx0Ly91dlxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB2ZXJ0c1tvZmYrK107XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHZlcnRzW29mZisrXTtcblx0fVxufSk7XG5cbi8qKlxuICogVGhlIGRlZmF1bHQgdmVydGV4IHNpemUsIGkuZS4gbnVtYmVyIG9mIGZsb2F0cyBwZXIgdmVydGV4LlxuICogQGF0dHJpYnV0ZSAgVkVSVEVYX1NJWkVcbiAqIEBzdGF0aWNcbiAqIEBmaW5hbFxuICogQHR5cGUge051bWJlcn1cbiAqIEBkZWZhdWx0ICA1XG4gKi9cblNwcml0ZUJhdGNoLlZFUlRFWF9TSVpFID0gNTtcblxuLyoqXG4gKiBJbmNyZW1lbnRlZCBhZnRlciBlYWNoIGRyYXcgY2FsbCwgY2FuIGJlIHVzZWQgZm9yIGRlYnVnZ2luZy5cbiAqXG4gKiAgICAgU3ByaXRlQmF0Y2gudG90YWxSZW5kZXJDYWxscyA9IDA7XG4gKlxuICogICAgIC4uLiBkcmF3IHlvdXIgc2NlbmUgLi4uXG4gKlxuICogICAgIGNvbnNvbGUubG9nKFwiRHJhdyBjYWxscyBwZXIgZnJhbWU6XCIsIFNwcml0ZUJhdGNoLnRvdGFsUmVuZGVyQ2FsbHMpO1xuICpcbiAqIFxuICogQGF0dHJpYnV0ZSAgdG90YWxSZW5kZXJDYWxsc1xuICogQHN0YXRpY1xuICogQHR5cGUge051bWJlcn1cbiAqIEBkZWZhdWx0ICAwXG4gKi9cblNwcml0ZUJhdGNoLnRvdGFsUmVuZGVyQ2FsbHMgPSAwO1xuXG5TcHJpdGVCYXRjaC5ERUZBVUxUX0ZSQUdfU0hBREVSID0gW1xuXHRcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1wiLFxuXHRcInZhcnlpbmcgdmVjMiB2VGV4Q29vcmQwO1wiLFxuXHRcInZhcnlpbmcgdmVjNCB2Q29sb3I7XCIsXG5cdFwidW5pZm9ybSBzYW1wbGVyMkQgdV90ZXh0dXJlMDtcIixcblxuXHRcInZvaWQgbWFpbih2b2lkKSB7XCIsXG5cdFwiICAgZ2xfRnJhZ0NvbG9yID0gdGV4dHVyZTJEKHVfdGV4dHVyZTAsIHZUZXhDb29yZDApICogdkNvbG9yO1wiLFxuXHRcIn1cIlxuXS5qb2luKCdcXG4nKTtcblxuU3ByaXRlQmF0Y2guREVGQVVMVF9WRVJUX1NIQURFUiA9IFtcblx0XCJhdHRyaWJ1dGUgdmVjMiBcIitTaGFkZXJQcm9ncmFtLlBPU0lUSU9OX0FUVFJJQlVURStcIjtcIixcblx0XCJhdHRyaWJ1dGUgdmVjNCBcIitTaGFkZXJQcm9ncmFtLkNPTE9SX0FUVFJJQlVURStcIjtcIixcblx0XCJhdHRyaWJ1dGUgdmVjMiBcIitTaGFkZXJQcm9ncmFtLlRFWENPT1JEX0FUVFJJQlVURStcIjA7XCIsXG5cblx0XCJ1bmlmb3JtIHZlYzIgdV9wcm9qZWN0aW9uO1wiLFxuXHRcInZhcnlpbmcgdmVjMiB2VGV4Q29vcmQwO1wiLFxuXHRcInZhcnlpbmcgdmVjNCB2Q29sb3I7XCIsXG5cblx0XCJ2b2lkIG1haW4odm9pZCkge1wiLCAvLy9UT0RPOiB1c2UgYSBwcm9qZWN0aW9uIGFuZCB0cmFuc2Zvcm0gbWF0cml4XG5cdFwiICAgZ2xfUG9zaXRpb24gPSB2ZWM0KCBcIlxuXHRcdCtTaGFkZXJQcm9ncmFtLlBPU0lUSU9OX0FUVFJJQlVURVxuXHRcdCtcIi54IC8gdV9wcm9qZWN0aW9uLnggLSAxLjAsIFwiXG5cdFx0K1NoYWRlclByb2dyYW0uUE9TSVRJT05fQVRUUklCVVRFXG5cdFx0K1wiLnkgLyAtdV9wcm9qZWN0aW9uLnkgKyAxLjAgLCAwLjAsIDEuMCk7XCIsXG5cdFwiICAgdlRleENvb3JkMCA9IFwiK1NoYWRlclByb2dyYW0uVEVYQ09PUkRfQVRUUklCVVRFK1wiMDtcIixcblx0XCIgICB2Q29sb3IgPSBcIitTaGFkZXJQcm9ncmFtLkNPTE9SX0FUVFJJQlVURStcIjtcIixcblx0XCJ9XCJcbl0uam9pbignXFxuJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gU3ByaXRlQmF0Y2g7XG4iLCIvKipcbiAqIEBtb2R1bGUga2FtaVxuICovXG5cbnZhciBDbGFzcyA9IHJlcXVpcmUoJ2tsYXNzZScpO1xudmFyIFNpZ25hbCA9IHJlcXVpcmUoJ3NpZ25hbHMnKTtcbnZhciBuZXh0UG93ZXJPZlR3byA9IHJlcXVpcmUoJ251bWJlci11dGlsJykubmV4dFBvd2VyT2ZUd287XG52YXIgaXNQb3dlck9mVHdvID0gcmVxdWlyZSgnbnVtYmVyLXV0aWwnKS5pc1Bvd2VyT2ZUd287XG5cbnZhciBUZXh0dXJlID0gbmV3IENsYXNzKHtcblxuXG5cdC8qKlxuXHQgKiBDcmVhdGVzIGEgbmV3IHRleHR1cmUgd2l0aCB0aGUgb3B0aW9uYWwgd2lkdGgsIGhlaWdodCwgYW5kIGRhdGEuXG5cdCAqXG5cdCAqIElmIHRoZSBjb25zdHJ1Y3RvciBpcyBwYXNzZWQgbm8gcGFyYW1ldGVycyBvdGhlciB0aGFuIFdlYkdMQ29udGV4dCwgdGhlblxuXHQgKiBpdCB3aWxsIG5vdCBiZSBpbml0aWFsaXplZCBhbmQgd2lsbCBiZSBub24tcmVuZGVyYWJsZS4gWW91IHdpbGwgbmVlZCB0byBtYW51YWxseVxuXHQgKiB1cGxvYWREYXRhIG9yIHVwbG9hZEltYWdlIHlvdXJzZWxmLlxuXHQgKlxuXHQgKiBJZiB5b3UgcGFzcyBhIHdpZHRoIGFuZCBoZWlnaHQgYWZ0ZXIgY29udGV4dCwgdGhlIHRleHR1cmUgd2lsbCBiZSBpbml0aWFsaXplZCB3aXRoIHRoYXQgc2l6ZVxuXHQgKiBhbmQgbnVsbCBkYXRhIChlLmcuIHRyYW5zcGFyZW50IGJsYWNrKS4gSWYgeW91IGFsc28gcGFzcyB0aGUgZm9ybWF0IGFuZCBkYXRhLCBcblx0ICogaXQgd2lsbCBiZSB1cGxvYWRlZCB0byB0aGUgdGV4dHVyZS4gXG5cdCAqXG5cdCAqIElmIHlvdSBwYXNzIGEgU3RyaW5nIG9yIERhdGEgVVJJIGFzIHRoZSBzZWNvbmQgcGFyYW1ldGVyLFxuXHQgKiB0aGlzIFRleHR1cmUgd2lsbCBsb2FkIGFuIEltYWdlIG9iamVjdCBhc3luY2hyb25vdXNseS4gVGhlIG9wdGlvbmFsIHRoaXJkXG5cdCAqIGFuZCBmb3VydGggcGFyYW1ldGVycyBhcmUgY2FsbGJhY2sgZnVuY3Rpb25zIGZvciBzdWNjZXNzIGFuZCBmYWlsdXJlLCByZXNwZWN0aXZlbHkuIFxuXHQgKiBUaGUgb3B0aW9uYWwgZmlmcnRoIHBhcmFtZXRlciBmb3IgdGhpcyB2ZXJzaW9uIG9mIHRoZSBjb25zdHJ1Y3RvciBpcyBnZW5NaXBtYXBzLCB3aGljaCBkZWZhdWx0cyB0byBmYWxzZS4gXG5cdCAqIFxuXHQgKiBUaGUgYXJndW1lbnRzIGFyZSBrZXB0IGluIG1lbW9yeSBmb3IgZnV0dXJlIGNvbnRleHQgcmVzdG9yYXRpb24gZXZlbnRzLiBJZlxuXHQgKiB0aGlzIGlzIHVuZGVzaXJhYmxlIChlLmcuIGh1Z2UgYnVmZmVycyB3aGljaCBuZWVkIHRvIGJlIEdDJ2QpLCB5b3Ugc2hvdWxkIG5vdFxuXHQgKiBwYXNzIHRoZSBkYXRhIGluIHRoZSBjb25zdHJ1Y3RvciwgYnV0IGluc3RlYWQgdXBsb2FkIGl0IGFmdGVyIGNyZWF0aW5nIGFuIHVuaW5pdGlhbGl6ZWQgXG5cdCAqIHRleHR1cmUuIFlvdSB3aWxsIG5lZWQgdG8gbWFuYWdlIGl0IHlvdXJzZWxmLCBlaXRoZXIgYnkgZXh0ZW5kaW5nIHRoZSBjcmVhdGUoKSBtZXRob2QsIFxuXHQgKiBvciBsaXN0ZW5pbmcgdG8gcmVzdG9yZWQgZXZlbnRzIGluIFdlYkdMQ29udGV4dC5cblx0ICpcblx0ICogTW9zdCB1c2VycyB3aWxsIHdhbnQgdG8gdXNlIHRoZSBBc3NldE1hbmFnZXIgdG8gY3JlYXRlIGFuZCBtYW5hZ2UgdGhlaXIgdGV4dHVyZXNcblx0ICogd2l0aCBhc3luY2hyb25vdXMgbG9hZGluZyBhbmQgY29udGV4dCBsb3NzLiBcblx0ICpcblx0ICogQGV4YW1wbGVcblx0ICogXHRcdG5ldyBUZXh0dXJlKGNvbnRleHQsIDI1NiwgMjU2KTsgLy9lbXB0eSAyNTZ4MjU2IHRleHR1cmVcblx0ICogXHRcdG5ldyBUZXh0dXJlKGNvbnRleHQsIDEsIDEsIFRleHR1cmUuRm9ybWF0LlJHQkEsIFRleHR1cmUuRGF0YVR5cGUuVU5TSUdORURfQllURSwgXG5cdCAqIFx0XHRcdFx0XHRuZXcgVWludDhBcnJheShbMjU1LDAsMCwyNTVdKSk7IC8vMXgxIHJlZCB0ZXh0dXJlXG5cdCAqIFx0XHRuZXcgVGV4dHVyZShjb250ZXh0LCBcInRlc3QucG5nXCIpOyAvL2xvYWRzIGltYWdlIGFzeW5jaHJvbm91c2x5XG5cdCAqIFx0XHRuZXcgVGV4dHVyZShjb250ZXh0LCBcInRlc3QucG5nXCIsIHN1Y2Nlc3NGdW5jLCBmYWlsRnVuYywgdXNlTWlwbWFwcyk7IC8vZXh0cmEgcGFyYW1zIGZvciBpbWFnZSBsYW9kZXIgXG5cdCAqXG5cdCAqIEBjbGFzcyAgVGV4dHVyZVxuXHQgKiBAY29uc3RydWN0b3Jcblx0ICogQHBhcmFtICB7V2ViR0xDb250ZXh0fSBjb250ZXh0IHRoZSBXZWJHTCBjb250ZXh0XG5cdCAqIEBwYXJhbSAge051bWJlcn0gd2lkdGggdGhlIHdpZHRoIG9mIHRoaXMgdGV4dHVyZVxuXHQgKiBAcGFyYW0gIHtOdW1iZXJ9IGhlaWdodCB0aGUgaGVpZ2h0IG9mIHRoaXMgdGV4dHVyZVxuXHQgKiBAcGFyYW0gIHtHTGVudW19IGZvcm1hdCBlLmcuIFRleHR1cmUuRm9ybWF0LlJHQkFcblx0ICogQHBhcmFtICB7R0xlbnVtfSBkYXRhVHlwZSBlLmcuIFRleHR1cmUuRGF0YVR5cGUuVU5TSUdORURfQllURSAoVWludDhBcnJheSlcblx0ICogQHBhcmFtICB7R0xlbnVtfSBkYXRhIHRoZSBhcnJheSBidWZmZXIsIGUuZy4gYSBVaW50OEFycmF5IHZpZXdcblx0ICogQHBhcmFtICB7Qm9vbGVhbn0gZ2VuTWlwbWFwcyB3aGV0aGVyIHRvIGdlbmVyYXRlIG1pcG1hcHMgYWZ0ZXIgdXBsb2FkaW5nIHRoZSBkYXRhXG5cdCAqL1xuXHRpbml0aWFsaXplOiBmdW5jdGlvbiBUZXh0dXJlKGNvbnRleHQsIHdpZHRoLCBoZWlnaHQsIGZvcm1hdCwgZGF0YVR5cGUsIGRhdGEsIGdlbk1pcG1hcHMpIHtcblx0XHRpZiAodHlwZW9mIGNvbnRleHQgIT09IFwib2JqZWN0XCIpXG5cdFx0XHR0aHJvdyBcIkdMIGNvbnRleHQgbm90IHNwZWNpZmllZCB0byBUZXh0dXJlXCI7XG5cdFx0dGhpcy5jb250ZXh0ID0gY29udGV4dDtcblxuXHRcdC8qKlxuXHRcdCAqIFRoZSBXZWJHTFRleHR1cmUgd2hpY2ggYmFja3MgdGhpcyBUZXh0dXJlIG9iamVjdC4gVGhpc1xuXHRcdCAqIGNhbiBiZSB1c2VkIGZvciBsb3ctbGV2ZWwgR0wgY2FsbHMuXG5cdFx0ICogXG5cdFx0ICogQHR5cGUge1dlYkdMVGV4dHVyZX1cblx0XHQgKi9cblx0XHR0aGlzLmlkID0gbnVsbDsgLy9pbml0aWFsaXplZCBpbiBjcmVhdGUoKVxuXG5cdFx0LyoqXG5cdFx0ICogVGhlIHRhcmdldCBmb3IgdGhpcyB0ZXh0dXJlIHVuaXQsIGkuZS4gVEVYVFVSRV8yRC4gU3ViY2xhc3Nlc1xuXHRcdCAqIHNob3VsZCBvdmVycmlkZSB0aGUgY3JlYXRlKCkgbWV0aG9kIHRvIGNoYW5nZSB0aGlzLCBmb3IgY29ycmVjdFxuXHRcdCAqIHVzYWdlIHdpdGggY29udGV4dCByZXN0b3JlLlxuXHRcdCAqIFxuXHRcdCAqIEBwcm9wZXJ0eSB0YXJnZXRcblx0XHQgKiBAdHlwZSB7R0xlbnVtfVxuXHRcdCAqIEBkZWZhdWx0ICBnbC5URVhUVVJFXzJEXG5cdFx0ICovXG5cdFx0dGhpcy50YXJnZXQgPSBjb250ZXh0LmdsLlRFWFRVUkVfMkQ7XG5cblx0XHQvKipcblx0XHQgKiBUaGUgd2lkdGggb2YgdGhpcyB0ZXh0dXJlLCBpbiBwaXhlbHMuXG5cdFx0ICogXG5cdFx0ICogQHByb3BlcnR5IHdpZHRoXG5cdFx0ICogQHJlYWRPbmx5XG5cdFx0ICogQHR5cGUge051bWJlcn0gdGhlIHdpZHRoXG5cdFx0ICovXG5cdFx0dGhpcy53aWR0aCA9IDA7IC8vaW5pdGlhbGl6ZWQgb24gdGV4dHVyZSB1cGxvYWRcblxuXHRcdC8qKlxuXHRcdCAqIFRoZSBoZWlnaHQgb2YgdGhpcyB0ZXh0dXJlLCBpbiBwaXhlbHMuXG5cdFx0ICogXG5cdFx0ICogQHByb3BlcnR5IGhlaWdodFxuXHRcdCAqIEByZWFkT25seVxuXHRcdCAqIEB0eXBlIHtOdW1iZXJ9IHRoZSBoZWlnaHRcblx0XHQgKi9cblx0XHR0aGlzLmhlaWdodCA9IDA7IC8vaW5pdGlhbGl6ZWQgb24gdGV4dHVyZSB1cGxvYWRcblxuXHRcdC8vIGUuZy4gLS0+IG5ldyBUZXh0dXJlKGdsLCAyNTYsIDI1NiwgZ2wuUkdCLCBnbC5VTlNJR05FRF9CWVRFLCBkYXRhKTtcblx0XHQvL1x0XHQgICAgICBjcmVhdGVzIGEgbmV3IGVtcHR5IHRleHR1cmUsIDI1NngyNTZcblx0XHQvL1x0XHQtLT4gbmV3IFRleHR1cmUoZ2wpO1xuXHRcdC8vXHRcdFx0ICBjcmVhdGVzIGEgbmV3IHRleHR1cmUgYnV0IFdJVEhPVVQgdXBsb2FkaW5nIGFueSBkYXRhLiBcblxuXHRcdC8qKlxuXHRcdCAqIFRoZSBTIHdyYXAgcGFyYW1ldGVyLlxuXHRcdCAqIEBwcm9wZXJ0eSB7R0xlbnVtfSB3cmFwU1xuXHRcdCAqL1xuXHRcdHRoaXMud3JhcFMgPSBUZXh0dXJlLkRFRkFVTFRfV1JBUDtcblx0XHQvKipcblx0XHQgKiBUaGUgVCB3cmFwIHBhcmFtZXRlci5cblx0XHQgKiBAcHJvcGVydHkge0dMZW51bX0gd3JhcFRcblx0XHQgKi9cblx0XHR0aGlzLndyYXBUID0gVGV4dHVyZS5ERUZBVUxUX1dSQVA7XG5cdFx0LyoqXG5cdFx0ICogVGhlIG1pbmlmY2F0aW9uIGZpbHRlci5cblx0XHQgKiBAcHJvcGVydHkge0dMZW51bX0gbWluRmlsdGVyIFxuXHRcdCAqL1xuXHRcdHRoaXMubWluRmlsdGVyID0gVGV4dHVyZS5ERUZBVUxUX0ZJTFRFUjtcblx0XHRcblx0XHQvKipcblx0XHQgKiBUaGUgbWFnbmlmaWNhdGlvbiBmaWx0ZXIuXG5cdFx0ICogQHByb3BlcnR5IHtHTGVudW19IG1hZ0ZpbHRlciBcblx0XHQgKi9cblx0XHR0aGlzLm1hZ0ZpbHRlciA9IFRleHR1cmUuREVGQVVMVF9GSUxURVI7XG5cblx0XHQvKipcblx0XHQgKiBXaGVuIGEgdGV4dHVyZSBpcyBjcmVhdGVkLCB3ZSBrZWVwIHRyYWNrIG9mIHRoZSBhcmd1bWVudHMgcHJvdmlkZWQgdG8gXG5cdFx0ICogaXRzIGNvbnN0cnVjdG9yLiBPbiBjb250ZXh0IGxvc3MgYW5kIHJlc3RvcmUsIHRoZXNlIGFyZ3VtZW50cyBhcmUgcmUtc3VwcGxpZWRcblx0XHQgKiB0byB0aGUgVGV4dHVyZSwgc28gYXMgdG8gcmUtY3JlYXRlIGl0IGluIGl0cyBjb3JyZWN0IGZvcm0uXG5cdFx0ICpcblx0XHQgKiBUaGlzIGlzIG1haW5seSB1c2VmdWwgaWYgeW91IGFyZSBwcm9jZWR1cmFsbHkgY3JlYXRpbmcgdGV4dHVyZXMgYW5kIHBhc3Npbmdcblx0XHQgKiB0aGVpciBkYXRhIGRpcmVjdGx5IChlLmcuIGZvciBnZW5lcmljIGxvb2t1cCB0YWJsZXMgaW4gYSBzaGFkZXIpLiBGb3IgaW1hZ2Vcblx0XHQgKiBvciBtZWRpYSBiYXNlZCB0ZXh0dXJlcywgaXQgd291bGQgYmUgYmV0dGVyIHRvIHVzZSBhbiBBc3NldE1hbmFnZXIgdG8gbWFuYWdlXG5cdFx0ICogdGhlIGFzeW5jaHJvbm91cyB0ZXh0dXJlIHVwbG9hZC5cblx0XHQgKlxuXHRcdCAqIFVwb24gZGVzdHJveWluZyBhIHRleHR1cmUsIGEgcmVmZXJlbmNlIHRvIHRoaXMgaXMgYWxzbyBsb3N0LlxuXHRcdCAqXG5cdFx0ICogQHByb3BlcnR5IG1hbmFnZWRBcmdzXG5cdFx0ICogQHR5cGUge0FycmF5fSB0aGUgYXJyYXkgb2YgYXJndW1lbnRzLCBzaGlmdGVkIHRvIGV4Y2x1ZGUgdGhlIFdlYkdMQ29udGV4dCBwYXJhbWV0ZXJcblx0XHQgKi9cblx0XHR0aGlzLm1hbmFnZWRBcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcblxuXHRcdC8vVGhpcyBpcyBtYWFuZ2VkIGJ5IFdlYkdMQ29udGV4dFxuXHRcdHRoaXMuY29udGV4dC5hZGRNYW5hZ2VkT2JqZWN0KHRoaXMpO1xuXHRcdHRoaXMuY3JlYXRlKCk7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFRoaXMgY2FuIGJlIGNhbGxlZCBhZnRlciBjcmVhdGluZyBhIFRleHR1cmUgdG8gbG9hZCBhbiBJbWFnZSBvYmplY3QgYXN5bmNocm9ub3VzbHksXG5cdCAqIG9yIHVwbG9hZCBpbWFnZSBkYXRhIGRpcmVjdGx5LiBJdCB0YWtlcyB0aGUgc2FtZSBwYXJhbWV0ZXJzIGFzIHRoZSBjb25zdHJ1Y3RvciwgZXhjZXB0IFxuXHQgKiBmb3IgdGhlIGNvbnRleHQgd2hpY2ggaGFzIGFscmVhZHkgYmVlbiBlc3RhYmxpc2hlZC4gXG5cdCAqXG5cdCAqIFVzZXJzIHdpbGwgZ2VuZXJhbGx5IG5vdCBuZWVkIHRvIGNhbGwgdGhpcyBkaXJlY3RseS4gXG5cdCAqIFxuXHQgKiBAcHJvdGVjdGVkXG5cdCAqIEBtZXRob2QgIHNldHVwXG5cdCAqL1xuXHRzZXR1cDogZnVuY3Rpb24od2lkdGgsIGhlaWdodCwgZm9ybWF0LCBkYXRhVHlwZSwgZGF0YSwgZ2VuTWlwbWFwcykge1xuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cblx0XHQvL0lmIHRoZSBmaXJzdCBhcmd1bWVudCBpcyBhIHN0cmluZywgYXNzdW1lIGl0J3MgYW4gSW1hZ2UgbG9hZGVyXG5cdFx0Ly9zZWNvbmQgYXJndW1lbnQgd2lsbCB0aGVuIGJlIGdlbk1pcG1hcHMsIHRoaXJkIGFuZCBmb3VydGggdGhlIHN1Y2Nlc3MvZmFpbCBjYWxsYmFja3Ncblx0XHRpZiAodHlwZW9mIHdpZHRoID09PSBcInN0cmluZ1wiKSB7XG5cdFx0XHR2YXIgaW1nID0gbmV3IEltYWdlKCk7XG5cdFx0XHR2YXIgcGF0aCAgICAgID0gYXJndW1lbnRzWzBdOyAgIC8vZmlyc3QgYXJndW1lbnQsIHRoZSBwYXRoXG5cdFx0XHR2YXIgc3VjY2Vzc0NCID0gdHlwZW9mIGFyZ3VtZW50c1sxXSA9PT0gXCJmdW5jdGlvblwiID8gYXJndW1lbnRzWzFdIDogbnVsbDtcblx0XHRcdHZhciBmYWlsQ0IgICAgPSB0eXBlb2YgYXJndW1lbnRzWzJdID09PSBcImZ1bmN0aW9uXCIgPyBhcmd1bWVudHNbMl0gOiBudWxsO1xuXHRcdFx0Z2VuTWlwbWFwcyAgICA9ICEhYXJndW1lbnRzWzNdO1xuXG5cdFx0XHR2YXIgc2VsZiA9IHRoaXM7XG5cblx0XHRcdC8vSWYgeW91IHRyeSB0byByZW5kZXIgYSB0ZXh0dXJlIHRoYXQgaXMgbm90IHlldCBcInJlbmRlcmFibGVcIiAoaS5lLiB0aGUgXG5cdFx0XHQvL2FzeW5jIGxvYWQgaGFzbid0IGNvbXBsZXRlZCB5ZXQsIHdoaWNoIGlzIGFsd2F5cyB0aGUgY2FzZSBpbiBDaHJvbWUgc2luY2UgcmVxdWVzdEFuaW1hdGlvbkZyYW1lXG5cdFx0XHQvL2ZpcmVzIGJlZm9yZSBpbWcub25sb2FkKSwgV2ViR0wgd2lsbCB0aHJvdyB1cyBlcnJvcnMuIFNvIGluc3RlYWQgd2Ugd2lsbCBqdXN0IHVwbG9hZCBzb21lXG5cdFx0XHQvL2R1bW15IGRhdGEgdW50aWwgdGhlIHRleHR1cmUgbG9hZCBpcyBjb21wbGV0ZS4gVXNlcnMgY2FuIGRpc2FibGUgdGhpcyB3aXRoIHRoZSBnbG9iYWwgZmxhZy5cblx0XHRcdGlmIChUZXh0dXJlLlVTRV9EVU1NWV8xeDFfREFUQSkge1xuXHRcdFx0XHRzZWxmLnVwbG9hZERhdGEoMSwgMSk7XG5cdFx0XHRcdHRoaXMud2lkdGggPSB0aGlzLmhlaWdodCA9IDA7XG5cdFx0XHR9XG5cblx0XHRcdGltZy5vbmxvYWQgPSBmdW5jdGlvbigpIHtcblx0XHRcdFx0c2VsZi51cGxvYWRJbWFnZShpbWcsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBnZW5NaXBtYXBzKTtcblx0XHRcdFx0aWYgKHN1Y2Nlc3NDQilcblx0XHRcdFx0XHRzdWNjZXNzQ0IoKTtcblx0XHRcdH1cblx0XHRcdGltZy5vbmVycm9yID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdC8vIGNvbnNvbGUud2FybihcIkVycm9yIGxvYWRpbmcgaW1hZ2U6IFwiK3BhdGgpO1xuXHRcdFx0XHRpZiAoZ2VuTWlwbWFwcykgLy93ZSBzdGlsbCBuZWVkIHRvIGdlbiBtaXBtYXBzIG9uIHRoZSAxeDEgZHVtbXlcblx0XHRcdFx0XHRnbC5nZW5lcmF0ZU1pcG1hcChnbC5URVhUVVJFXzJEKTtcblx0XHRcdFx0aWYgKGZhaWxDQilcblx0XHRcdFx0XHRmYWlsQ0IoKTtcblx0XHRcdH1cblx0XHRcdGltZy5vbmFib3J0ID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdC8vIGNvbnNvbGUud2FybihcIkltYWdlIGxvYWQgYWJvcnRlZDogXCIrcGF0aCk7XG5cdFx0XHRcdGlmIChnZW5NaXBtYXBzKSAvL3dlIHN0aWxsIG5lZWQgdG8gZ2VuIG1pcG1hcHMgb24gdGhlIDF4MSBkdW1teVxuXHRcdFx0XHRcdGdsLmdlbmVyYXRlTWlwbWFwKGdsLlRFWFRVUkVfMkQpO1xuXHRcdFx0XHRpZiAoZmFpbENCKVxuXHRcdFx0XHRcdGZhaWxDQigpO1xuXHRcdFx0fVxuXG5cdFx0XHRpbWcuc3JjID0gcGF0aDtcblx0XHR9IFxuXHRcdC8vb3RoZXJ3aXNlIGFzc3VtZSBvdXIgcmVndWxhciBsaXN0IG9mIHdpZHRoL2hlaWdodCBhcmd1bWVudHMgYXJlIHBhc3NlZFxuXHRcdGVsc2Uge1xuXHRcdFx0dGhpcy51cGxvYWREYXRhKHdpZHRoLCBoZWlnaHQsIGZvcm1hdCwgZGF0YVR5cGUsIGRhdGEsIGdlbk1pcG1hcHMpO1xuXHRcdH1cblx0fSxcdFxuXG5cdC8qKlxuXHQgKiBDYWxsZWQgaW4gdGhlIFRleHR1cmUgY29uc3RydWN0b3IsIGFuZCBhZnRlciB0aGUgR0wgY29udGV4dCBoYXMgYmVlbiByZS1pbml0aWFsaXplZC4gXG5cdCAqIFN1YmNsYXNzZXMgY2FuIG92ZXJyaWRlIHRoaXMgdG8gcHJvdmlkZSBhIGN1c3RvbSBkYXRhIHVwbG9hZCwgZS5nLiBjdWJlbWFwcyBvciBjb21wcmVzc2VkXG5cdCAqIHRleHR1cmVzLlxuXHQgKlxuXHQgKiBAbWV0aG9kICBjcmVhdGVcblx0ICovXG5cdGNyZWF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5nbCA9IHRoaXMuY29udGV4dC5nbDsgXG5cdFx0dmFyIGdsID0gdGhpcy5nbDtcblxuXHRcdHRoaXMuaWQgPSBnbC5jcmVhdGVUZXh0dXJlKCk7IC8vdGV4dHVyZSBJRCBpcyByZWNyZWF0ZWRcblx0XHR0aGlzLndpZHRoID0gdGhpcy5oZWlnaHQgPSAwOyAvL3NpemUgaXMgcmVzZXQgdG8gemVybyB1bnRpbCBsb2FkZWRcblx0XHR0aGlzLnRhcmdldCA9IGdsLlRFWFRVUkVfMkQ7ICAvL3RoZSBwcm92aWRlciBjYW4gY2hhbmdlIHRoaXMgaWYgbmVjZXNzYXJ5IChlLmcuIGN1YmUgbWFwcylcblxuXHRcdHRoaXMuYmluZCgpO1xuXG5cblx0XHQvL1RPRE86IGNsZWFuIHRoZXNlIHVwIGEgbGl0dGxlLiBcblx0XHRnbC5waXhlbFN0b3JlaShnbC5VTlBBQ0tfUFJFTVVMVElQTFlfQUxQSEFfV0VCR0wsIFRleHR1cmUuVU5QQUNLX1BSRU1VTFRJUExZX0FMUEhBKTtcblx0XHRnbC5waXhlbFN0b3JlaShnbC5VTlBBQ0tfQUxJR05NRU5ULCBUZXh0dXJlLlVOUEFDS19BTElHTk1FTlQpO1xuXHRcdGdsLnBpeGVsU3RvcmVpKGdsLlVOUEFDS19GTElQX1lfV0VCR0wsIFRleHR1cmUuVU5QQUNLX0ZMSVBfWSk7XG5cdFx0XG5cdFx0dmFyIGNvbG9yc3BhY2UgPSBUZXh0dXJlLlVOUEFDS19DT0xPUlNQQUNFX0NPTlZFUlNJT04gfHwgZ2wuQlJPV1NFUl9ERUZBVUxUX1dFQkdMO1xuXHRcdGdsLnBpeGVsU3RvcmVpKGdsLlVOUEFDS19DT0xPUlNQQUNFX0NPTlZFUlNJT05fV0VCR0wsIGNvbG9yc3BhY2UpO1xuXG5cdFx0Ly9zZXR1cCB3cmFwIG1vZGVzIHdpdGhvdXQgYmluZGluZyByZWR1bmRhbnRseVxuXHRcdHRoaXMuc2V0V3JhcCh0aGlzLndyYXBTLCB0aGlzLndyYXBULCBmYWxzZSk7XG5cdFx0dGhpcy5zZXRGaWx0ZXIodGhpcy5taW5GaWx0ZXIsIHRoaXMubWFnRmlsdGVyLCBmYWxzZSk7XG5cdFx0XG5cdFx0aWYgKHRoaXMubWFuYWdlZEFyZ3MubGVuZ3RoICE9PSAwKSB7XG5cdFx0XHR0aGlzLnNldHVwLmFwcGx5KHRoaXMsIHRoaXMubWFuYWdlZEFyZ3MpO1xuXHRcdH1cblx0fSxcblxuXHQvKipcblx0ICogRGVzdHJveXMgdGhpcyB0ZXh0dXJlIGJ5IGRlbGV0aW5nIHRoZSBHTCByZXNvdXJjZSxcblx0ICogcmVtb3ZpbmcgaXQgZnJvbSB0aGUgV2ViR0xDb250ZXh0IG1hbmFnZW1lbnQgc3RhY2ssXG5cdCAqIHNldHRpbmcgaXRzIHNpemUgdG8gemVybywgYW5kIGlkIGFuZCBtYW5hZ2VkIGFyZ3VtZW50cyB0byBudWxsLlxuXHQgKiBcblx0ICogVHJ5aW5nIHRvIHVzZSB0aGlzIHRleHR1cmUgYWZ0ZXIgbWF5IGxlYWQgdG8gdW5kZWZpbmVkIGJlaGF2aW91ci5cblx0ICpcblx0ICogQG1ldGhvZCAgZGVzdHJveVxuXHQgKi9cblx0ZGVzdHJveTogZnVuY3Rpb24oKSB7XG5cdFx0aWYgKHRoaXMuaWQgJiYgdGhpcy5nbClcblx0XHRcdHRoaXMuZ2wuZGVsZXRlVGV4dHVyZSh0aGlzLmlkKTtcblx0XHRpZiAodGhpcy5jb250ZXh0KVxuXHRcdFx0dGhpcy5jb250ZXh0LnJlbW92ZU1hbmFnZWRPYmplY3QodGhpcyk7XG5cdFx0dGhpcy53aWR0aCA9IHRoaXMuaGVpZ2h0ID0gMDtcblx0XHR0aGlzLmlkID0gbnVsbDtcblx0XHR0aGlzLm1hbmFnZWRBcmdzID0gbnVsbDtcblx0XHR0aGlzLmNvbnRleHQgPSBudWxsO1xuXHRcdHRoaXMuZ2wgPSBudWxsO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBTZXRzIHRoZSB3cmFwIG1vZGUgZm9yIHRoaXMgdGV4dHVyZTsgaWYgdGhlIHNlY29uZCBhcmd1bWVudFxuXHQgKiBpcyB1bmRlZmluZWQgb3IgZmFsc3ksIHRoZW4gYm90aCBTIGFuZCBUIHdyYXAgd2lsbCB1c2UgdGhlIGZpcnN0XG5cdCAqIGFyZ3VtZW50LlxuXHQgKlxuXHQgKiBZb3UgY2FuIHVzZSBUZXh0dXJlLldyYXAgY29uc3RhbnRzIGZvciBjb252ZW5pZW5jZSwgdG8gYXZvaWQgbmVlZGluZyBcblx0ICogYSBHTCByZWZlcmVuY2UuXG5cdCAqXG5cdCAqIEBtZXRob2QgIHNldFdyYXBcblx0ICogQHBhcmFtIHtHTGVudW19IHMgdGhlIFMgd3JhcCBtb2RlXG5cdCAqIEBwYXJhbSB7R0xlbnVtfSB0IHRoZSBUIHdyYXAgbW9kZVxuXHQgKiBAcGFyYW0ge0Jvb2xlYW59IGlnbm9yZUJpbmQgKG9wdGlvbmFsKSBpZiB0cnVlLCB0aGUgYmluZCB3aWxsIGJlIGlnbm9yZWQuIFxuXHQgKi9cblx0c2V0V3JhcDogZnVuY3Rpb24ocywgdCwgaWdub3JlQmluZCkgeyAvL1RPRE86IHN1cHBvcnQgUiB3cmFwIG1vZGVcblx0XHRpZiAocyAmJiB0KSB7XG5cdFx0XHR0aGlzLndyYXBTID0gcztcblx0XHRcdHRoaXMud3JhcFQgPSB0O1xuXHRcdH0gZWxzZSBcblx0XHRcdHRoaXMud3JhcFMgPSB0aGlzLndyYXBUID0gcztcblx0XHRcblx0XHQvL2VuZm9yY2UgUE9UIHJ1bGVzLi5cblx0XHR0aGlzLl9jaGVja1BPVCgpO1x0XG5cblx0XHRpZiAoIWlnbm9yZUJpbmQpXG5cdFx0XHR0aGlzLmJpbmQoKTtcblxuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cdFx0Z2wudGV4UGFyYW1ldGVyaSh0aGlzLnRhcmdldCwgZ2wuVEVYVFVSRV9XUkFQX1MsIHRoaXMud3JhcFMpO1xuXHRcdGdsLnRleFBhcmFtZXRlcmkodGhpcy50YXJnZXQsIGdsLlRFWFRVUkVfV1JBUF9ULCB0aGlzLndyYXBUKTtcblx0fSxcblxuXG5cdC8qKlxuXHQgKiBTZXRzIHRoZSBtaW4gYW5kIG1hZyBmaWx0ZXIgZm9yIHRoaXMgdGV4dHVyZTsgXG5cdCAqIGlmIG1hZyBpcyB1bmRlZmluZWQgb3IgZmFsc3ksIHRoZW4gYm90aCBtaW4gYW5kIG1hZyB3aWxsIHVzZSB0aGVcblx0ICogZmlsdGVyIHNwZWNpZmllZCBmb3IgbWluLlxuXHQgKlxuXHQgKiBZb3UgY2FuIHVzZSBUZXh0dXJlLkZpbHRlciBjb25zdGFudHMgZm9yIGNvbnZlbmllbmNlLCB0byBhdm9pZCBuZWVkaW5nIFxuXHQgKiBhIEdMIHJlZmVyZW5jZS5cblx0ICpcblx0ICogQG1ldGhvZCAgc2V0RmlsdGVyXG5cdCAqIEBwYXJhbSB7R0xlbnVtfSBtaW4gdGhlIG1pbmlmaWNhdGlvbiBmaWx0ZXJcblx0ICogQHBhcmFtIHtHTGVudW19IG1hZyB0aGUgbWFnbmlmaWNhdGlvbiBmaWx0ZXJcblx0ICogQHBhcmFtIHtCb29sZWFufSBpZ25vcmVCaW5kIGlmIHRydWUsIHRoZSBiaW5kIHdpbGwgYmUgaWdub3JlZC4gXG5cdCAqL1xuXHRzZXRGaWx0ZXI6IGZ1bmN0aW9uKG1pbiwgbWFnLCBpZ25vcmVCaW5kKSB7IFxuXHRcdGlmIChtaW4gJiYgbWFnKSB7XG5cdFx0XHR0aGlzLm1pbkZpbHRlciA9IG1pbjtcblx0XHRcdHRoaXMubWFnRmlsdGVyID0gbWFnO1xuXHRcdH0gZWxzZSBcblx0XHRcdHRoaXMubWluRmlsdGVyID0gdGhpcy5tYWdGaWx0ZXIgPSBtaW47XG5cdFx0XG5cdFx0Ly9lbmZvcmNlIFBPVCBydWxlcy4uXG5cdFx0dGhpcy5fY2hlY2tQT1QoKTtcblxuXHRcdGlmICghaWdub3JlQmluZClcblx0XHRcdHRoaXMuYmluZCgpO1xuXG5cdFx0dmFyIGdsID0gdGhpcy5nbDtcblx0XHRnbC50ZXhQYXJhbWV0ZXJpKHRoaXMudGFyZ2V0LCBnbC5URVhUVVJFX01JTl9GSUxURVIsIHRoaXMubWluRmlsdGVyKTtcblx0XHRnbC50ZXhQYXJhbWV0ZXJpKHRoaXMudGFyZ2V0LCBnbC5URVhUVVJFX01BR19GSUxURVIsIHRoaXMubWFnRmlsdGVyKTtcblx0fSxcblxuXHQvKipcblx0ICogQSBsb3ctbGV2ZWwgbWV0aG9kIHRvIHVwbG9hZCB0aGUgc3BlY2lmaWVkIEFycmF5QnVmZmVyVmlld1xuXHQgKiB0byB0aGlzIHRleHR1cmUuIFRoaXMgd2lsbCBjYXVzZSB0aGUgd2lkdGggYW5kIGhlaWdodCBvZiB0aGlzXG5cdCAqIHRleHR1cmUgdG8gY2hhbmdlLlxuXHQgKlxuXHQgKiBAbWV0aG9kICB1cGxvYWREYXRhXG5cdCAqIEBwYXJhbSAge051bWJlcn0gd2lkdGggICAgICAgICAgdGhlIG5ldyB3aWR0aCBvZiB0aGlzIHRleHR1cmUsXG5cdCAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVmYXVsdHMgdG8gdGhlIGxhc3QgdXNlZCB3aWR0aCAob3IgemVybylcblx0ICogQHBhcmFtICB7TnVtYmVyfSBoZWlnaHQgICAgICAgICB0aGUgbmV3IGhlaWdodCBvZiB0aGlzIHRleHR1cmVcblx0ICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWZhdWx0cyB0byB0aGUgbGFzdCB1c2VkIGhlaWdodCAob3IgemVybylcblx0ICogQHBhcmFtICB7R0xlbnVtfSBmb3JtYXQgICAgICAgICB0aGUgZGF0YSBmb3JtYXQsIGRlZmF1bHQgUkdCQVxuXHQgKiBAcGFyYW0gIHtHTGVudW19IHR5cGUgICAgICAgICAgIHRoZSBkYXRhIHR5cGUsIGRlZmF1bHQgVU5TSUdORURfQllURSAoVWludDhBcnJheSlcblx0ICogQHBhcmFtICB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhICB0aGUgcmF3IGRhdGEgZm9yIHRoaXMgdGV4dHVyZSwgb3IgbnVsbCBmb3IgYW4gZW1wdHkgaW1hZ2Vcblx0ICogQHBhcmFtICB7Qm9vbGVhbn0gZ2VuTWlwbWFwc1x0ICAgd2hldGhlciB0byBnZW5lcmF0ZSBtaXBtYXBzIGFmdGVyIHVwbG9hZGluZyB0aGUgZGF0YSwgZGVmYXVsdCBmYWxzZVxuXHQgKi9cblx0dXBsb2FkRGF0YTogZnVuY3Rpb24od2lkdGgsIGhlaWdodCwgZm9ybWF0LCB0eXBlLCBkYXRhLCBnZW5NaXBtYXBzKSB7XG5cdFx0dmFyIGdsID0gdGhpcy5nbDtcblxuXHRcdGZvcm1hdCA9IGZvcm1hdCB8fCBnbC5SR0JBO1xuXHRcdHR5cGUgPSB0eXBlIHx8IGdsLlVOU0lHTkVEX0JZVEU7XG5cdFx0ZGF0YSA9IGRhdGEgfHwgbnVsbDsgLy9tYWtlIHN1cmUgZmFsc2V5IHZhbHVlIGlzIG51bGwgZm9yIHRleEltYWdlMkRcblxuXHRcdHRoaXMud2lkdGggPSAod2lkdGggfHwgd2lkdGg9PTApID8gd2lkdGggOiB0aGlzLndpZHRoO1xuXHRcdHRoaXMuaGVpZ2h0ID0gKGhlaWdodCB8fCBoZWlnaHQ9PTApID8gaGVpZ2h0IDogdGhpcy5oZWlnaHQ7XG5cblx0XHR0aGlzLl9jaGVja1BPVCgpO1xuXG5cdFx0dGhpcy5iaW5kKCk7XG5cblx0XHRnbC50ZXhJbWFnZTJEKHRoaXMudGFyZ2V0LCAwLCBmb3JtYXQsIFxuXHRcdFx0XHRcdCAgdGhpcy53aWR0aCwgdGhpcy5oZWlnaHQsIDAsIGZvcm1hdCxcblx0XHRcdFx0XHQgIHR5cGUsIGRhdGEpO1xuXG5cdFx0aWYgKGdlbk1pcG1hcHMpXG5cdFx0XHRnbC5nZW5lcmF0ZU1pcG1hcCh0aGlzLnRhcmdldCk7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFVwbG9hZHMgSW1hZ2VEYXRhLCBIVE1MSW1hZ2VFbGVtZW50LCBIVE1MQ2FudmFzRWxlbWVudCBvciBcblx0ICogSFRNTFZpZGVvRWxlbWVudC5cblx0ICpcblx0ICogQG1ldGhvZCAgdXBsb2FkSW1hZ2Vcblx0ICogQHBhcmFtICB7T2JqZWN0fSBkb21PYmplY3QgdGhlIERPTSBpbWFnZSBjb250YWluZXJcblx0ICogQHBhcmFtICB7R0xlbnVtfSBmb3JtYXQgdGhlIGZvcm1hdCwgZGVmYXVsdCBnbC5SR0JBXG5cdCAqIEBwYXJhbSAge0dMZW51bX0gdHlwZSB0aGUgZGF0YSB0eXBlLCBkZWZhdWx0IGdsLlVOU0lHTkVEX0JZVEVcblx0ICogQHBhcmFtICB7Qm9vbGVhbn0gZ2VuTWlwbWFwcyB3aGV0aGVyIHRvIGdlbmVyYXRlIG1pcG1hcHMgYWZ0ZXIgdXBsb2FkaW5nIHRoZSBkYXRhLCBkZWZhdWx0IGZhbHNlXG5cdCAqL1xuXHR1cGxvYWRJbWFnZTogZnVuY3Rpb24oZG9tT2JqZWN0LCBmb3JtYXQsIHR5cGUsIGdlbk1pcG1hcHMpIHtcblx0XHR2YXIgZ2wgPSB0aGlzLmdsO1xuXG5cdFx0Zm9ybWF0ID0gZm9ybWF0IHx8IGdsLlJHQkE7XG5cdFx0dHlwZSA9IHR5cGUgfHwgZ2wuVU5TSUdORURfQllURTtcblx0XHRcblx0XHR0aGlzLndpZHRoID0gZG9tT2JqZWN0LndpZHRoO1xuXHRcdHRoaXMuaGVpZ2h0ID0gZG9tT2JqZWN0LmhlaWdodDtcblxuXHRcdHRoaXMuX2NoZWNrUE9UKCk7XG5cblx0XHR0aGlzLmJpbmQoKTtcblxuXHRcdGdsLnRleEltYWdlMkQodGhpcy50YXJnZXQsIDAsIGZvcm1hdCwgZm9ybWF0LFxuXHRcdFx0XHRcdCAgdHlwZSwgZG9tT2JqZWN0KTtcblxuXHRcdGlmIChnZW5NaXBtYXBzKVxuXHRcdFx0Z2wuZ2VuZXJhdGVNaXBtYXAodGhpcy50YXJnZXQpO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBJZiBGT1JDRV9QT1QgaXMgZmFsc2UsIHdlIHZlcmlmeSB0aGlzIHRleHR1cmUgdG8gc2VlIGlmIGl0IGlzIHZhbGlkLCBcblx0ICogYXMgcGVyIG5vbi1wb3dlci1vZi10d28gcnVsZXMuIElmIGl0IGlzIG5vbi1wb3dlci1vZi10d28sIGl0IG11c3QgaGF2ZSBcblx0ICogYSB3cmFwIG1vZGUgb2YgQ0xBTVBfVE9fRURHRSwgYW5kIHRoZSBtaW5pZmljYXRpb24gZmlsdGVyIG11c3QgYmUgTElORUFSXG5cdCAqIG9yIE5FQVJFU1QuIElmIHdlIGRvbid0IHNhdGlzZnkgdGhlc2UgbmVlZHMsIGFuIGVycm9yIGlzIHRocm93bi5cblx0ICogXG5cdCAqIEBtZXRob2QgIF9jaGVja1BPVFxuXHQgKiBAcHJpdmF0ZVxuXHQgKiBAcmV0dXJuIHtbdHlwZV19IFtkZXNjcmlwdGlvbl1cblx0ICovXG5cdF9jaGVja1BPVDogZnVuY3Rpb24oKSB7XG5cdFx0aWYgKCFUZXh0dXJlLkZPUkNFX1BPVCkge1xuXHRcdFx0Ly9JZiBtaW5GaWx0ZXIgaXMgYW55dGhpbmcgYnV0IExJTkVBUiBvciBORUFSRVNUXG5cdFx0XHQvL29yIGlmIHdyYXBTIG9yIHdyYXBUIGFyZSBub3QgQ0xBTVBfVE9fRURHRS4uLlxuXHRcdFx0dmFyIHdyb25nRmlsdGVyID0gKHRoaXMubWluRmlsdGVyICE9PSBUZXh0dXJlLkZpbHRlci5MSU5FQVIgJiYgdGhpcy5taW5GaWx0ZXIgIT09IFRleHR1cmUuRmlsdGVyLk5FQVJFU1QpO1xuXHRcdFx0dmFyIHdyb25nV3JhcCA9ICh0aGlzLndyYXBTICE9PSBUZXh0dXJlLldyYXAuQ0xBTVBfVE9fRURHRSB8fCB0aGlzLndyYXBUICE9PSBUZXh0dXJlLldyYXAuQ0xBTVBfVE9fRURHRSk7XG5cblx0XHRcdGlmICggd3JvbmdGaWx0ZXIgfHwgd3JvbmdXcmFwICkge1xuXHRcdFx0XHRpZiAoIWlzUG93ZXJPZlR3byh0aGlzLndpZHRoKSB8fCAhaXNQb3dlck9mVHdvKHRoaXMuaGVpZ2h0KSlcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3Iod3JvbmdGaWx0ZXIgXG5cdFx0XHRcdFx0XHRcdD8gXCJOb24tcG93ZXItb2YtdHdvIHRleHR1cmVzIGNhbm5vdCB1c2UgbWlwbWFwcGluZyBhcyBmaWx0ZXJcIlxuXHRcdFx0XHRcdFx0XHQ6IFwiTm9uLXBvd2VyLW9mLXR3byB0ZXh0dXJlcyBtdXN0IHVzZSBDTEFNUF9UT19FREdFIGFzIHdyYXBcIik7XG5cdFx0XHR9XG5cdFx0fVxuXHR9LFxuXG5cdC8qKlxuXHQgKiBCaW5kcyB0aGUgdGV4dHVyZS4gSWYgdW5pdCBpcyBzcGVjaWZpZWQsXG5cdCAqIGl0IHdpbGwgYmluZCB0aGUgdGV4dHVyZSBhdCB0aGUgZ2l2ZW4gc2xvdFxuXHQgKiAoVEVYVFVSRTAsIFRFWFRVUkUxLCBldGMpLiBJZiB1bml0IGlzIG5vdCBzcGVjaWZpZWQsXG5cdCAqIGl0IHdpbGwgc2ltcGx5IGJpbmQgdGhlIHRleHR1cmUgYXQgd2hpY2hldmVyIHNsb3Rcblx0ICogaXMgY3VycmVudGx5IGFjdGl2ZS5cblx0ICpcblx0ICogQG1ldGhvZCAgYmluZFxuXHQgKiBAcGFyYW0gIHtOdW1iZXJ9IHVuaXQgdGhlIHRleHR1cmUgdW5pdCBpbmRleCwgc3RhcnRpbmcgYXQgMFxuXHQgKi9cblx0YmluZDogZnVuY3Rpb24odW5pdCkge1xuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cdFx0aWYgKHVuaXQgfHwgdW5pdCA9PT0gMClcblx0XHRcdGdsLmFjdGl2ZVRleHR1cmUoZ2wuVEVYVFVSRTAgKyB1bml0KTtcblx0XHRnbC5iaW5kVGV4dHVyZSh0aGlzLnRhcmdldCwgdGhpcy5pZCk7XG5cdH0sXG5cblx0dG9TdHJpbmc6IGZ1bmN0aW9uKCkge1xuXHRcdHJldHVybiB0aGlzLmlkICsgXCI6XCIgKyB0aGlzLndpZHRoICsgXCJ4XCIgKyB0aGlzLmhlaWdodCArIFwiXCI7XG5cdH1cbn0pO1xuXG4vKiogXG4gKiBBIHNldCBvZiBGaWx0ZXIgY29uc3RhbnRzIHRoYXQgbWF0Y2ggdGhlaXIgR0wgY291bnRlcnBhcnRzLlxuICogVGhpcyBpcyBmb3IgY29udmVuaWVuY2UsIHRvIGF2b2lkIHRoZSBuZWVkIGZvciBhIEdMIHJlbmRlcmluZyBjb250ZXh0LlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGBcbiAqICAgICBUZXh0dXJlLkZpbHRlci5ORUFSRVNUXG4gKiAgICAgVGV4dHVyZS5GaWx0ZXIuTkVBUkVTVF9NSVBNQVBfTElORUFSXG4gKiAgICAgVGV4dHVyZS5GaWx0ZXIuTkVBUkVTVF9NSVBNQVBfTkVBUkVTVFxuICogICAgIFRleHR1cmUuRmlsdGVyLkxJTkVBUlxuICogICAgIFRleHR1cmUuRmlsdGVyLkxJTkVBUl9NSVBNQVBfTElORUFSXG4gKiAgICAgVGV4dHVyZS5GaWx0ZXIuTElORUFSX01JUE1BUF9ORUFSRVNUXG4gKiBgYGBcbiAqIEBhdHRyaWJ1dGUgRmlsdGVyXG4gKiBAc3RhdGljXG4gKiBAdHlwZSB7T2JqZWN0fVxuICovXG5UZXh0dXJlLkZpbHRlciA9IHtcblx0TkVBUkVTVDogOTcyOCxcblx0TkVBUkVTVF9NSVBNQVBfTElORUFSOiA5OTg2LFxuXHRORUFSRVNUX01JUE1BUF9ORUFSRVNUOiA5OTg0LFxuXHRMSU5FQVI6IDk3MjksXG5cdExJTkVBUl9NSVBNQVBfTElORUFSOiA5OTg3LFxuXHRMSU5FQVJfTUlQTUFQX05FQVJFU1Q6IDk5ODVcbn07XG5cbi8qKiBcbiAqIEEgc2V0IG9mIFdyYXAgY29uc3RhbnRzIHRoYXQgbWF0Y2ggdGhlaXIgR0wgY291bnRlcnBhcnRzLlxuICogVGhpcyBpcyBmb3IgY29udmVuaWVuY2UsIHRvIGF2b2lkIHRoZSBuZWVkIGZvciBhIEdMIHJlbmRlcmluZyBjb250ZXh0LlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGBcbiAqICAgICBUZXh0dXJlLldyYXAuQ0xBTVBfVE9fRURHRVxuICogICAgIFRleHR1cmUuV3JhcC5NSVJST1JFRF9SRVBFQVRcbiAqICAgICBUZXh0dXJlLldyYXAuUkVQRUFUXG4gKiBgYGBcbiAqIEBhdHRyaWJ1dGUgV3JhcFxuICogQHN0YXRpY1xuICogQHR5cGUge09iamVjdH1cbiAqL1xuVGV4dHVyZS5XcmFwID0ge1xuXHRDTEFNUF9UT19FREdFOiAzMzA3MSxcblx0TUlSUk9SRURfUkVQRUFUOiAzMzY0OCxcblx0UkVQRUFUOiAxMDQ5N1xufTtcblxuLyoqIFxuICogQSBzZXQgb2YgRm9ybWF0IGNvbnN0YW50cyB0aGF0IG1hdGNoIHRoZWlyIEdMIGNvdW50ZXJwYXJ0cy5cbiAqIFRoaXMgaXMgZm9yIGNvbnZlbmllbmNlLCB0byBhdm9pZCB0aGUgbmVlZCBmb3IgYSBHTCByZW5kZXJpbmcgY29udGV4dC5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgXG4gKiAgICAgVGV4dHVyZS5Gb3JtYXQuUkdCXG4gKiAgICAgVGV4dHVyZS5Gb3JtYXQuUkdCQVxuICogICAgIFRleHR1cmUuRm9ybWF0LkxVTUlOQU5DRV9BTFBIQVxuICogYGBgXG4gKiBAYXR0cmlidXRlIEZvcm1hdFxuICogQHN0YXRpY1xuICogQHR5cGUge09iamVjdH1cbiAqL1xuVGV4dHVyZS5Gb3JtYXQgPSB7XG5cdERFUFRIX0NPTVBPTkVOVDogNjQwMixcblx0QUxQSEE6IDY0MDYsXG5cdFJHQkE6IDY0MDgsXG5cdFJHQjogNjQwNyxcblx0TFVNSU5BTkNFOiA2NDA5LFxuXHRMVU1JTkFOQ0VfQUxQSEE6IDY0MTBcbn07XG5cbi8qKiBcbiAqIEEgc2V0IG9mIERhdGFUeXBlIGNvbnN0YW50cyB0aGF0IG1hdGNoIHRoZWlyIEdMIGNvdW50ZXJwYXJ0cy5cbiAqIFRoaXMgaXMgZm9yIGNvbnZlbmllbmNlLCB0byBhdm9pZCB0aGUgbmVlZCBmb3IgYSBHTCByZW5kZXJpbmcgY29udGV4dC5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgXG4gKiAgICAgVGV4dHVyZS5EYXRhVHlwZS5VTlNJR05FRF9CWVRFIFxuICogICAgIFRleHR1cmUuRGF0YVR5cGUuRkxPQVQgXG4gKiBgYGBcbiAqIEBhdHRyaWJ1dGUgRGF0YVR5cGVcbiAqIEBzdGF0aWNcbiAqIEB0eXBlIHtPYmplY3R9XG4gKi9cblRleHR1cmUuRGF0YVR5cGUgPSB7XG5cdEJZVEU6IDUxMjAsXG5cdFNIT1JUOiA1MTIyLFxuXHRJTlQ6IDUxMjQsXG5cdEZMT0FUOiA1MTI2LFxuXHRVTlNJR05FRF9CWVRFOiA1MTIxLFxuXHRVTlNJR05FRF9JTlQ6IDUxMjUsXG5cdFVOU0lHTkVEX1NIT1JUOiA1MTIzLFxuXHRVTlNJR05FRF9TSE9SVF80XzRfNF80OiAzMjgxOSxcblx0VU5TSUdORURfU0hPUlRfNV81XzVfMTogMzI4MjAsXG5cdFVOU0lHTkVEX1NIT1JUXzVfNl81OiAzMzYzNVxufVxuXG4vKipcbiAqIFRoZSBkZWZhdWx0IHdyYXAgbW9kZSB3aGVuIGNyZWF0aW5nIG5ldyB0ZXh0dXJlcy4gSWYgYSBjdXN0b20gXG4gKiBwcm92aWRlciB3YXMgc3BlY2lmaWVkLCBpdCBtYXkgY2hvb3NlIHRvIG92ZXJyaWRlIHRoaXMgZGVmYXVsdCBtb2RlLlxuICogXG4gKiBAYXR0cmlidXRlIHtHTGVudW19IERFRkFVTFRfV1JBUFxuICogQHN0YXRpYyBcbiAqIEBkZWZhdWx0ICBUZXh0dXJlLldyYXAuQ0xBTVBfVE9fRURHRVxuICovXG5UZXh0dXJlLkRFRkFVTFRfV1JBUCA9IFRleHR1cmUuV3JhcC5DTEFNUF9UT19FREdFO1xuXG5cbi8qKlxuICogVGhlIGRlZmF1bHQgZmlsdGVyIG1vZGUgd2hlbiBjcmVhdGluZyBuZXcgdGV4dHVyZXMuIElmIGEgY3VzdG9tXG4gKiBwcm92aWRlciB3YXMgc3BlY2lmaWVkLCBpdCBtYXkgY2hvb3NlIHRvIG92ZXJyaWRlIHRoaXMgZGVmYXVsdCBtb2RlLlxuICpcbiAqIEBhdHRyaWJ1dGUge0dMZW51bX0gREVGQVVMVF9GSUxURVJcbiAqIEBzdGF0aWNcbiAqIEBkZWZhdWx0ICBUZXh0dXJlLkZpbHRlci5MSU5FQVJcbiAqL1xuVGV4dHVyZS5ERUZBVUxUX0ZJTFRFUiA9IFRleHR1cmUuRmlsdGVyLk5FQVJFU1Q7XG5cbi8qKlxuICogQnkgZGVmYXVsdCwgd2UgZG8gc29tZSBlcnJvciBjaGVja2luZyB3aGVuIGNyZWF0aW5nIHRleHR1cmVzXG4gKiB0byBlbnN1cmUgdGhhdCB0aGV5IHdpbGwgYmUgXCJyZW5kZXJhYmxlXCIgYnkgV2ViR0wuIE5vbi1wb3dlci1vZi10d29cbiAqIHRleHR1cmVzIG11c3QgdXNlIENMQU1QX1RPX0VER0UgYXMgdGhlaXIgd3JhcCBtb2RlLCBhbmQgTkVBUkVTVCBvciBMSU5FQVJcbiAqIGFzIHRoZWlyIHdyYXAgbW9kZS4gRnVydGhlciwgdHJ5aW5nIHRvIGdlbmVyYXRlIG1pcG1hcHMgZm9yIGEgTlBPVCBpbWFnZVxuICogd2lsbCBsZWFkIHRvIGVycm9ycy4gXG4gKlxuICogSG93ZXZlciwgeW91IGNhbiBkaXNhYmxlIHRoaXMgZXJyb3IgY2hlY2tpbmcgYnkgc2V0dGluZyBgRk9SQ0VfUE9UYCB0byB0cnVlLlxuICogVGhpcyBtYXkgYmUgdXNlZnVsIGlmIHlvdSBhcmUgcnVubmluZyBvbiBzcGVjaWZpYyBoYXJkd2FyZSB0aGF0IHN1cHBvcnRzIFBPVCBcbiAqIHRleHR1cmVzLCBvciBpbiBzb21lIGZ1dHVyZSBjYXNlIHdoZXJlIE5QT1QgdGV4dHVyZXMgaXMgYWRkZWQgYXMgYSBXZWJHTCBleHRlbnNpb24uXG4gKiBcbiAqIEBhdHRyaWJ1dGUge0Jvb2xlYW59IEZPUkNFX1BPVFxuICogQHN0YXRpY1xuICogQGRlZmF1bHQgIGZhbHNlXG4gKi9cblRleHR1cmUuRk9SQ0VfUE9UID0gZmFsc2U7XG5cbi8vZGVmYXVsdCBwaXhlbCBzdG9yZSBvcGVyYXRpb25zLiBVc2VkIGluIGNyZWF0ZSgpXG5UZXh0dXJlLlVOUEFDS19GTElQX1kgPSBmYWxzZTtcblRleHR1cmUuVU5QQUNLX0FMSUdOTUVOVCA9IDE7XG5UZXh0dXJlLlVOUEFDS19QUkVNVUxUSVBMWV9BTFBIQSA9IHRydWU7IFxuVGV4dHVyZS5VTlBBQ0tfQ09MT1JTUEFDRV9DT05WRVJTSU9OID0gdW5kZWZpbmVkO1xuXG4vL2ZvciB0aGUgSW1hZ2UgY29uc3RydWN0b3Igd2UgbmVlZCB0byBoYW5kbGUgdGhpbmdzIGEgYml0IGRpZmZlcmVudGx5Li5cblRleHR1cmUuVVNFX0RVTU1ZXzF4MV9EQVRBID0gdHJ1ZTtcblxuLyoqXG4gKiBVdGlsaXR5IHRvIGdldCB0aGUgbnVtYmVyIG9mIGNvbXBvbmVudHMgZm9yIHRoZSBnaXZlbiBHTGVudW0sIGUuZy4gZ2wuUkdCQSByZXR1cm5zIDQuXG4gKiBSZXR1cm5zIG51bGwgaWYgdGhlIHNwZWNpZmllZCBmb3JtYXQgaXMgbm90IG9mIHR5cGUgREVQVEhfQ09NUE9ORU5ULCBBTFBIQSwgTFVNSU5BTkNFLFxuICogTFVNSU5BTkNFX0FMUEhBLCBSR0IsIG9yIFJHQkEuXG4gKiBcbiAqIEBtZXRob2QgZ2V0TnVtQ29tcG9uZW50c1xuICogQHN0YXRpY1xuICogQHBhcmFtICB7R0xlbnVtfSBmb3JtYXQgYSB0ZXh0dXJlIGZvcm1hdCwgaS5lLiBUZXh0dXJlLkZvcm1hdC5SR0JBXG4gKiBAcmV0dXJuIHtOdW1iZXJ9IHRoZSBudW1iZXIgb2YgY29tcG9uZW50cyBmb3IgdGhpcyBmb3JtYXRcbiAqL1xuVGV4dHVyZS5nZXROdW1Db21wb25lbnRzID0gZnVuY3Rpb24oZm9ybWF0KSB7XG5cdHN3aXRjaCAoZm9ybWF0KSB7XG5cdFx0Y2FzZSBUZXh0dXJlLkZvcm1hdC5ERVBUSF9DT01QT05FTlQ6XG5cdFx0Y2FzZSBUZXh0dXJlLkZvcm1hdC5BTFBIQTpcblx0XHRjYXNlIFRleHR1cmUuRm9ybWF0LkxVTUlOQU5DRTpcblx0XHRcdHJldHVybiAxO1xuXHRcdGNhc2UgVGV4dHVyZS5Gb3JtYXQuTFVNSU5BTkNFX0FMUEhBOlxuXHRcdFx0cmV0dXJuIDI7XG5cdFx0Y2FzZSBUZXh0dXJlLkZvcm1hdC5SR0I6XG5cdFx0XHRyZXR1cm4gMztcblx0XHRjYXNlIFRleHR1cmUuRm9ybWF0LlJHQkE6XG5cdFx0XHRyZXR1cm4gNDtcblx0fVxuXHRyZXR1cm4gbnVsbDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gVGV4dHVyZTsiLCJ2YXIgQ2xhc3MgPSByZXF1aXJlKCdrbGFzc2UnKTtcblxuLy9UaGlzIGlzIGEgR0wtc3BlY2lmaWMgdGV4dHVyZSByZWdpb24sIGVtcGxveWluZyB0YW5nZW50IHNwYWNlIG5vcm1hbGl6ZWQgY29vcmRpbmF0ZXMgVSBhbmQgVi5cbi8vQSBjYW52YXMtc3BlY2lmaWMgcmVnaW9uIHdvdWxkIHJlYWxseSBqdXN0IGJlIGEgbGlnaHR3ZWlnaHQgb2JqZWN0IHdpdGggeyB4LCB5LCB3aWR0aCwgaGVpZ2h0IH1cbi8vaW4gcGl4ZWxzLlxudmFyIFRleHR1cmVSZWdpb24gPSBuZXcgQ2xhc3Moe1xuXG5cdGluaXRpYWxpemU6IGZ1bmN0aW9uIFRleHR1cmVSZWdpb24odGV4dHVyZSwgeCwgeSwgd2lkdGgsIGhlaWdodCkge1xuXHRcdHRoaXMudGV4dHVyZSA9IHRleHR1cmU7XG5cdFx0dGhpcy5zZXRSZWdpb24oeCwgeSwgd2lkdGgsIGhlaWdodCk7XG5cdH0sXG5cblx0c2V0VVZzOiBmdW5jdGlvbih1LCB2LCB1MiwgdjIpIHtcblx0XHR0aGlzLnJlZ2lvbldpZHRoID0gTWF0aC5yb3VuZChNYXRoLmFicyh1MiAtIHUpICogdGhpcy50ZXh0dXJlLndpZHRoKTtcbiAgICAgICAgdGhpcy5yZWdpb25IZWlnaHQgPSBNYXRoLnJvdW5kKE1hdGguYWJzKHYyIC0gdikgKiB0aGlzLnRleHR1cmUuaGVpZ2h0KTtcblxuICAgICAgICAvLyBGcm9tIExpYkdEWCBUZXh0dXJlUmVnaW9uLmphdmEgLS0gXG5cdFx0Ly8gRm9yIGEgMXgxIHJlZ2lvbiwgYWRqdXN0IFVWcyB0b3dhcmQgcGl4ZWwgY2VudGVyIHRvIGF2b2lkIGZpbHRlcmluZyBhcnRpZmFjdHMgb24gQU1EIEdQVXMgd2hlbiBkcmF3aW5nIHZlcnkgc3RyZXRjaGVkLlxuXHRcdGlmICh0aGlzLnJlZ2lvbldpZHRoID09IDEgJiYgdGhpcy5yZWdpb25IZWlnaHQgPT0gMSkge1xuXHRcdFx0dmFyIGFkanVzdFggPSAwLjI1IC8gdGhpcy50ZXh0dXJlLndpZHRoO1xuXHRcdFx0dSArPSBhZGp1c3RYO1xuXHRcdFx0dTIgLT0gYWRqdXN0WDtcblx0XHRcdHZhciBhZGp1c3RZID0gMC4yNSAvIHRoaXMudGV4dHVyZS5oZWlnaHQ7XG5cdFx0XHR2ICs9IGFkanVzdFk7XG5cdFx0XHR2MiAtPSBhZGp1c3RZO1xuXHRcdH1cblxuXHRcdHRoaXMudSA9IHU7XG5cdFx0dGhpcy52ID0gdjtcblx0XHR0aGlzLnUyID0gdTI7XG5cdFx0dGhpcy52MiA9IHYyO1xuXHR9LFxuXG5cdHNldFJlZ2lvbjogZnVuY3Rpb24oeCwgeSwgd2lkdGgsIGhlaWdodCkge1xuXHRcdHggPSB4IHx8IDA7XG5cdFx0eSA9IHkgfHwgMDtcblx0XHR3aWR0aCA9ICh3aWR0aD09PTAgfHwgd2lkdGgpID8gd2lkdGggOiB0aGlzLnRleHR1cmUud2lkdGg7XG5cdFx0aGVpZ2h0ID0gKGhlaWdodD09PTAgfHwgaGVpZ2h0KSA/IGhlaWdodCA6IHRoaXMudGV4dHVyZS5oZWlnaHQ7XG5cblx0XHR2YXIgaW52VGV4V2lkdGggPSAxIC8gdGhpcy50ZXh0dXJlLndpZHRoO1xuXHRcdHZhciBpbnZUZXhIZWlnaHQgPSAxIC8gdGhpcy50ZXh0dXJlLmhlaWdodDtcblx0XHR0aGlzLnNldFVWcyh4ICogaW52VGV4V2lkdGgsIHkgKiBpbnZUZXhIZWlnaHQsICh4ICsgd2lkdGgpICogaW52VGV4V2lkdGgsICh5ICsgaGVpZ2h0KSAqIGludlRleEhlaWdodCk7XG5cdFx0dGhpcy5yZWdpb25XaWR0aCA9IE1hdGguYWJzKHdpZHRoKTtcblx0XHR0aGlzLnJlZ2lvbkhlaWdodCA9IE1hdGguYWJzKGhlaWdodCk7XG5cdH0sXG5cblx0LyoqIFNldHMgdGhlIHRleHR1cmUgdG8gdGhhdCBvZiB0aGUgc3BlY2lmaWVkIHJlZ2lvbiBhbmQgc2V0cyB0aGUgY29vcmRpbmF0ZXMgcmVsYXRpdmUgdG8gdGhlIHNwZWNpZmllZCByZWdpb24uICovXG5cdHNldEZyb21SZWdpb246IGZ1bmN0aW9uKHJlZ2lvbiwgeCwgeSwgd2lkdGgsIGhlaWdodCkge1xuXHRcdHRoaXMudGV4dHVyZSA9IHJlZ2lvbi50ZXh0dXJlO1xuXHRcdHRoaXMuc2V0KHJlZ2lvbi5nZXRSZWdpb25YKCkgKyB4LCByZWdpb24uZ2V0UmVnaW9uWSgpICsgeSwgd2lkdGgsIGhlaWdodCk7XG5cdH0sXG5cblxuXHQvL1RPRE86IGFkZCBzZXR0ZXJzIGZvciByZWdpb25YL1kgYW5kIHJlZ2lvbldpZHRoL0hlaWdodFxuXG5cdHJlZ2lvblg6IHtcblx0XHRnZXQ6IGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIE1hdGgucm91bmQodGhpcy51ICogdGhpcy50ZXh0dXJlLndpZHRoKTtcblx0XHR9IFxuXHR9LFxuXG5cdHJlZ2lvblk6IHtcblx0XHRnZXQ6IGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIE1hdGgucm91bmQodGhpcy52ICogdGhpcy50ZXh0dXJlLmhlaWdodCk7XG5cdFx0fVxuXHR9LFxuXG5cdGZsaXA6IGZ1bmN0aW9uKHgsIHkpIHtcblx0XHR2YXIgdGVtcDtcblx0XHRpZiAoeCkge1xuXHRcdFx0dGVtcCA9IHRoaXMudTtcblx0XHRcdHRoaXMudSA9IHRoaXMudTI7XG5cdFx0XHR0aGlzLnUyID0gdGVtcDtcblx0XHR9XG5cdFx0aWYgKHkpIHtcblx0XHRcdHRlbXAgPSB0aGlzLnY7XG5cdFx0XHR0aGlzLnYgPSB0aGlzLnYyO1xuXHRcdFx0dGhpcy52MiA9IHRlbXA7XG5cdFx0fVxuXHR9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBUZXh0dXJlUmVnaW9uOyIsIi8qKlxuICogQG1vZHVsZSBrYW1pXG4gKi9cblxudmFyIENsYXNzID0gcmVxdWlyZSgna2xhc3NlJyk7XG52YXIgU2lnbmFsID0gcmVxdWlyZSgnc2lnbmFscycpO1xuXG4vKipcbiAqIEEgdGhpbiB3cmFwcGVyIGFyb3VuZCBXZWJHTFJlbmRlcmluZ0NvbnRleHQgd2hpY2ggaGFuZGxlc1xuICogY29udGV4dCBsb3NzIGFuZCByZXN0b3JlIHdpdGggdmFyaW91cyByZW5kZXJpbmcgb2JqZWN0cyAodGV4dHVyZXMsXG4gKiBzaGFkZXJzIGFuZCBidWZmZXJzKS4gVGhpcyBhbHNvIGhhbmRsZXMgZ2VuZXJhbCB2aWV3cG9ydCBtYW5hZ2VtZW50LlxuICpcbiAqIElmIHRoZSB2aWV3IGlzIG5vdCBzcGVjaWZpZWQsIGEgY2FudmFzIHdpbGwgYmUgY3JlYXRlZC5cbiAqXG4gKiBJZiB0aGUgYHZpZXdgIHBhcmFtZXRlciBpcyBhbiBpbnN0YW5jZW9mIFdlYkdMUmVuZGVyaW5nQ29udGV4dCxcbiAqIHdlIHdpbGwgdXNlIGl0cyBjYW52YXMgYW5kIGNvbnRleHQgd2l0aG91dCBmZXRjaGluZyBhbm90aGVyIHRocm91Z2ggYGdldENvbnRleHRgLlxuICogUGFzc2luZyBhIGNhbnZhcyB0aGF0IGhhcyBhbHJlYWR5IGhhZCBgZ2V0Q29udGV4dCgnd2ViZ2wnKWAgY2FsbGVkIHdpbGwgbm90IGNhdXNlXG4gKiBlcnJvcnMsIGJ1dCBpbiBjZXJ0YWluIGRlYnVnZ2VycyAoZS5nLiBDaHJvbWUgV2ViR0wgSW5zcGVjdG9yKSBvbmx5IHRoZSBsYXRlc3RcbiAqIGNvbnRleHQgd2lsbCBiZSB0cmFjZWQuXG4gKiBcbiAqIEBjbGFzcyAgV2ViR0xDb250ZXh0XG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSB7TnVtYmVyfSB3aWR0aCB0aGUgd2lkdGggb2YgdGhlIEdMIGNhbnZhc1xuICogQHBhcmFtIHtOdW1iZXJ9IGhlaWdodCB0aGUgaGVpZ2h0IG9mIHRoZSBHTCBjYW52YXNcbiAqIEBwYXJhbSB7SFRNTENhbnZhc0VsZW1lbnR9IHZpZXcgdGhlIG9wdGlvbmFsIERPTSBjYW52YXMgZWxlbWVudFxuICogQHBhcmFtIHtPYmplY3R9IGNvbnRleHRBdHRyaWJ1ZXRzIGFuIG9iamVjdCBjb250YWluaW5nIGNvbnRleHQgYXR0cmlicyB3aGljaFxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdpbGwgYmUgdXNlZCBkdXJpbmcgR0wgaW5pdGlhbGl6YXRpb25cbiAqL1xudmFyIFdlYkdMQ29udGV4dCA9IG5ldyBDbGFzcyh7XG5cdFxuXHRpbml0aWFsaXplOiBmdW5jdGlvbiBXZWJHTENvbnRleHQod2lkdGgsIGhlaWdodCwgdmlldywgY29udGV4dEF0dHJpYnV0ZXMpIHtcblx0XHQvKipcblx0XHQgKiBUaGUgbGlzdCBvZiByZW5kZXJpbmcgb2JqZWN0cyAoc2hhZGVycywgVkJPcywgdGV4dHVyZXMsIGV0Yykgd2hpY2ggYXJlIFxuXHRcdCAqIGN1cnJlbnRseSBiZWluZyBtYW5hZ2VkLiBBbnkgb2JqZWN0IHdpdGggYSBcImNyZWF0ZVwiIG1ldGhvZCBjYW4gYmUgYWRkZWRcblx0XHQgKiB0byB0aGlzIGxpc3QuIFVwb24gZGVzdHJveWluZyB0aGUgcmVuZGVyaW5nIG9iamVjdCwgaXQgc2hvdWxkIGJlIHJlbW92ZWQuXG5cdFx0ICogU2VlIGFkZE1hbmFnZWRPYmplY3QgYW5kIHJlbW92ZU1hbmFnZWRPYmplY3QuXG5cdFx0ICogXG5cdFx0ICogQHByb3BlcnR5IHtBcnJheX0gbWFuYWdlZE9iamVjdHNcblx0XHQgKi9cblx0XHR0aGlzLm1hbmFnZWRPYmplY3RzID0gW107XG5cblx0XHQvKipcblx0XHQgKiBUaGUgYWN0dWFsIEdMIGNvbnRleHQuIFlvdSBjYW4gdXNlIHRoaXMgZm9yXG5cdFx0ICogcmF3IEdMIGNhbGxzIG9yIHRvIGFjY2VzcyBHTGVudW0gY29uc3RhbnRzLiBUaGlzXG5cdFx0ICogd2lsbCBiZSB1cGRhdGVkIG9uIGNvbnRleHQgcmVzdG9yZS4gV2hpbGUgdGhlIFdlYkdMQ29udGV4dFxuXHRcdCAqIGlzIG5vdCBgdmFsaWRgLCB5b3Ugc2hvdWxkIG5vdCB0cnkgdG8gYWNjZXNzIEdMIHN0YXRlLlxuXHRcdCAqIFxuXHRcdCAqIEBwcm9wZXJ0eSBnbFxuXHRcdCAqIEB0eXBlIHtXZWJHTFJlbmRlcmluZ0NvbnRleHR9XG5cdFx0ICovXG5cdFx0dGhpcy5nbCA9IG51bGw7XG5cblx0XHRpZiAodmlldyAmJiB0eXBlb2Ygd2luZG93LldlYkdMUmVuZGVyaW5nQ29udGV4dCAhPT0gXCJ1bmRlZmluZWRcIlxuXHRcdFx0XHQgJiYgdmlldyBpbnN0YW5jZW9mIHdpbmRvdy5XZWJHTFJlbmRlcmluZ0NvbnRleHQpIHtcblx0XHRcdHZpZXcgPSB2aWV3LmNhbnZhcztcblx0XHRcdHRoaXMuZ2wgPSB2aWV3O1xuXHRcdFx0dGhpcy52YWxpZCA9IHRydWU7XG5cdFx0XHRjb250ZXh0QXR0cmlidXRlcyA9IHVuZGVmaW5lZDsgLy9qdXN0IGlnbm9yZSBuZXcgYXR0cmlicy4uLlxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFRoZSBjYW52YXMgRE9NIGVsZW1lbnQgZm9yIHRoaXMgY29udGV4dC5cblx0XHQgKiBAcHJvcGVydHkge051bWJlcn0gdmlld1xuXHRcdCAqL1xuXHRcdHRoaXMudmlldyA9IHZpZXcgfHwgZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImNhbnZhc1wiKTtcblxuXHRcdC8vZGVmYXVsdCBzaXplIGFzIHBlciBzcGVjOlxuXHRcdC8vaHR0cDovL3d3dy53My5vcmcvVFIvMjAxMi9XRC1odG1sNS1hdXRob3ItMjAxMjAzMjkvdGhlLWNhbnZhcy1lbGVtZW50Lmh0bWwjdGhlLWNhbnZhcy1lbGVtZW50XG5cdFx0XG5cdFx0LyoqXG5cdFx0ICogVGhlIHdpZHRoIG9mIHRoaXMgY2FudmFzLlxuXHRcdCAqXG5cdFx0ICogQHByb3BlcnR5IHdpZHRoXG5cdFx0ICogQHR5cGUge051bWJlcn1cblx0XHQgKi9cblx0XHR0aGlzLndpZHRoID0gdGhpcy52aWV3LndpZHRoID0gd2lkdGggfHwgMzAwO1xuXG5cdFx0LyoqXG5cdFx0ICogVGhlIGhlaWdodCBvZiB0aGlzIGNhbnZhcy5cblx0XHQgKiBAcHJvcGVydHkgaGVpZ2h0XG5cdFx0ICogQHR5cGUge051bWJlcn1cblx0XHQgKi9cblx0XHR0aGlzLmhlaWdodCA9IHRoaXMudmlldy5oZWlnaHQgPSBoZWlnaHQgfHwgMTUwO1xuXG5cblx0XHQvKipcblx0XHQgKiBUaGUgY29udGV4dCBhdHRyaWJ1dGVzIGZvciBpbml0aWFsaXppbmcgdGhlIEdMIHN0YXRlLiBUaGlzIG1pZ2h0IGluY2x1ZGVcblx0XHQgKiBhbnRpLWFsaWFzaW5nLCBhbHBoYSBzZXR0aW5ncywgdmVyaXNvbiwgYW5kIHNvIGZvcnRoLlxuXHRcdCAqIFxuXHRcdCAqIEBwcm9wZXJ0eSB7T2JqZWN0fSBjb250ZXh0QXR0cmlidXRlcyBcblx0XHQgKi9cblx0XHR0aGlzLmNvbnRleHRBdHRyaWJ1dGVzID0gY29udGV4dEF0dHJpYnV0ZXM7XG5cdFx0XG5cdFx0LyoqXG5cdFx0ICogV2hldGhlciB0aGlzIGNvbnRleHQgaXMgJ3ZhbGlkJywgaS5lLiByZW5kZXJhYmxlLiBBIGNvbnRleHQgdGhhdCBoYXMgYmVlbiBsb3N0XG5cdFx0ICogKGFuZCBub3QgeWV0IHJlc3RvcmVkKSBvciBkZXN0cm95ZWQgaXMgaW52YWxpZC5cblx0XHQgKiBcblx0XHQgKiBAcHJvcGVydHkge0Jvb2xlYW59IHZhbGlkXG5cdFx0ICovXG5cdFx0dGhpcy52YWxpZCA9IGZhbHNlO1xuXG5cdFx0LyoqXG5cdFx0ICogQSBzaWduYWwgZGlzcGF0Y2hlZCB3aGVuIEdMIGNvbnRleHQgaXMgbG9zdC4gXG5cdFx0ICogXG5cdFx0ICogVGhlIGZpcnN0IGFyZ3VtZW50IHBhc3NlZCB0byB0aGUgbGlzdGVuZXIgaXMgdGhlIFdlYkdMQ29udGV4dFxuXHRcdCAqIG1hbmFnaW5nIHRoZSBjb250ZXh0IGxvc3MuXG5cdFx0ICogXG5cdFx0ICogQGV2ZW50IHtTaWduYWx9IGxvc3Rcblx0XHQgKi9cblx0XHR0aGlzLmxvc3QgPSBuZXcgU2lnbmFsKCk7XG5cblx0XHQvKipcblx0XHQgKiBBIHNpZ25hbCBkaXNwYXRjaGVkIHdoZW4gR0wgY29udGV4dCBpcyByZXN0b3JlZCwgYWZ0ZXIgYWxsIHRoZSBtYW5hZ2VkXG5cdFx0ICogb2JqZWN0cyBoYXZlIGJlZW4gcmVjcmVhdGVkLlxuXHRcdCAqXG5cdFx0ICogVGhlIGZpcnN0IGFyZ3VtZW50IHBhc3NlZCB0byB0aGUgbGlzdGVuZXIgaXMgdGhlIFdlYkdMQ29udGV4dFxuXHRcdCAqIHdoaWNoIG1hbmFnZWQgdGhlIHJlc3RvcmF0aW9uLlxuXHRcdCAqXG5cdFx0ICogVGhpcyBkb2VzIG5vdCBnYXVyZW50ZWUgdGhhdCBhbGwgb2JqZWN0cyB3aWxsIGJlIHJlbmRlcmFibGUuXG5cdFx0ICogRm9yIGV4YW1wbGUsIGEgVGV4dHVyZSB3aXRoIGFuIEltYWdlUHJvdmlkZXIgbWF5IHN0aWxsIGJlIGxvYWRpbmdcblx0XHQgKiBhc3luY2hyb25vdXNseS5cdCBcblx0XHQgKiBcblx0XHQgKiBAZXZlbnQge1NpZ25hbH0gcmVzdG9yZWRcblx0XHQgKi9cblx0XHR0aGlzLnJlc3RvcmVkID0gbmV3IFNpZ25hbCgpO1x0XG5cdFx0XG5cdFx0Ly9zZXR1cCBjb250ZXh0IGxvc3QgYW5kIHJlc3RvcmUgbGlzdGVuZXJzXG5cdFx0dGhpcy52aWV3LmFkZEV2ZW50TGlzdGVuZXIoXCJ3ZWJnbGNvbnRleHRsb3N0XCIsIGZ1bmN0aW9uIChldikge1xuXHRcdFx0ZXYucHJldmVudERlZmF1bHQoKTtcblx0XHRcdHRoaXMuX2NvbnRleHRMb3N0KGV2KTtcblx0XHR9LmJpbmQodGhpcykpO1xuXHRcdHRoaXMudmlldy5hZGRFdmVudExpc3RlbmVyKFwid2ViZ2xjb250ZXh0cmVzdG9yZWRcIiwgZnVuY3Rpb24gKGV2KSB7XG5cdFx0XHRldi5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0dGhpcy5fY29udGV4dFJlc3RvcmVkKGV2KTtcblx0XHR9LmJpbmQodGhpcykpO1xuXHRcdFx0XG5cdFx0aWYgKCF0aGlzLnZhbGlkKSAvL3dvdWxkIG9ubHkgYmUgdmFsaWQgaWYgV2ViR0xSZW5kZXJpbmdDb250ZXh0IHdhcyBwYXNzZWQgXG5cdFx0XHR0aGlzLl9pbml0Q29udGV4dCgpO1xuXG5cdFx0dGhpcy5yZXNpemUodGhpcy53aWR0aCwgdGhpcy5oZWlnaHQpO1xuXHR9LFxuXHRcblx0X2luaXRDb250ZXh0OiBmdW5jdGlvbigpIHtcblx0XHR2YXIgZXJyID0gXCJcIjtcblx0XHR0aGlzLnZhbGlkID0gZmFsc2U7XG5cblx0XHR0cnkge1xuXHRcdFx0dGhpcy5nbCA9ICh0aGlzLnZpZXcuZ2V0Q29udGV4dCgnd2ViZ2wnLCB0aGlzLmNvbnRleHRBdHRyaWJ1dGVzKSBcblx0XHRcdFx0XHRcdHx8IHRoaXMudmlldy5nZXRDb250ZXh0KCdleHBlcmltZW50YWwtd2ViZ2wnLCB0aGlzLmNvbnRleHRBdHRyaWJ1dGVzKSk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0dGhpcy5nbCA9IG51bGw7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuZ2wpIHtcblx0XHRcdHRoaXMudmFsaWQgPSB0cnVlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aHJvdyBcIldlYkdMIENvbnRleHQgTm90IFN1cHBvcnRlZCAtLSB0cnkgZW5hYmxpbmcgaXQgb3IgdXNpbmcgYSBkaWZmZXJlbnQgYnJvd3NlclwiO1xuXHRcdH1cdFxuXHR9LFxuXG5cdC8qKlxuXHQgKiBVcGRhdGVzIHRoZSB3aWR0aCBhbmQgaGVpZ2h0IG9mIHRoaXMgV2ViR0wgY29udGV4dCwgcmVzaXplc1xuXHQgKiB0aGUgY2FudmFzIHZpZXcsIGFuZCBjYWxscyBnbC52aWV3cG9ydCgpIHdpdGggdGhlIG5ldyBzaXplLlxuXHQgKiBcblx0ICogQHBhcmFtICB7TnVtYmVyfSB3aWR0aCAgdGhlIG5ldyB3aWR0aFxuXHQgKiBAcGFyYW0gIHtOdW1iZXJ9IGhlaWdodCB0aGUgbmV3IGhlaWdodFxuXHQgKi9cblx0cmVzaXplOiBmdW5jdGlvbih3aWR0aCwgaGVpZ2h0KSB7XG5cdFx0dGhpcy53aWR0aCA9IHdpZHRoO1xuXHRcdHRoaXMuaGVpZ2h0ID0gaGVpZ2h0O1xuXG5cdFx0dGhpcy52aWV3LndpZHRoID0gd2lkdGg7XG5cdFx0dGhpcy52aWV3LmhlaWdodCA9IGhlaWdodDtcblxuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cdFx0Z2wudmlld3BvcnQoMCwgMCwgdGhpcy53aWR0aCwgdGhpcy5oZWlnaHQpO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiAoaW50ZXJuYWwgdXNlKVxuXHQgKiBBIG1hbmFnZWQgb2JqZWN0IGlzIGFueXRoaW5nIHdpdGggYSBcImNyZWF0ZVwiIGZ1bmN0aW9uLCB0aGF0IHdpbGxcblx0ICogcmVzdG9yZSBHTCBzdGF0ZSBhZnRlciBjb250ZXh0IGxvc3MuIFxuXHQgKiBcblx0ICogQHBhcmFtIHtbdHlwZV19IHRleCBbZGVzY3JpcHRpb25dXG5cdCAqL1xuXHRhZGRNYW5hZ2VkT2JqZWN0OiBmdW5jdGlvbihvYmopIHtcblx0XHR0aGlzLm1hbmFnZWRPYmplY3RzLnB1c2gob2JqKTtcblx0fSxcblxuXHQvKipcblx0ICogKGludGVybmFsIHVzZSlcblx0ICogUmVtb3ZlcyBhIG1hbmFnZWQgb2JqZWN0IGZyb20gdGhlIGNhY2hlLiBUaGlzIGlzIHVzZWZ1bCB0byBkZXN0cm95XG5cdCAqIGEgdGV4dHVyZSBvciBzaGFkZXIsIGFuZCBoYXZlIGl0IG5vIGxvbmdlciByZS1sb2FkIG9uIGNvbnRleHQgcmVzdG9yZS5cblx0ICpcblx0ICogUmV0dXJucyB0aGUgb2JqZWN0IHRoYXQgd2FzIHJlbW92ZWQsIG9yIG51bGwgaWYgaXQgd2FzIG5vdCBmb3VuZCBpbiB0aGUgY2FjaGUuXG5cdCAqIFxuXHQgKiBAcGFyYW0gIHtPYmplY3R9IG9iaiB0aGUgb2JqZWN0IHRvIGJlIG1hbmFnZWRcblx0ICogQHJldHVybiB7T2JqZWN0fSAgICAgdGhlIHJlbW92ZWQgb2JqZWN0LCBvciBudWxsXG5cdCAqL1xuXHRyZW1vdmVNYW5hZ2VkT2JqZWN0OiBmdW5jdGlvbihvYmopIHtcblx0XHR2YXIgaWR4ID0gdGhpcy5tYW5hZ2VkT2JqZWN0cy5pbmRleE9mKG9iaik7XG5cdFx0aWYgKGlkeCA+IC0xKSB7XG5cdFx0XHR0aGlzLm1hbmFnZWRPYmplY3RzLnNwbGljZShpZHgsIDEpO1xuXHRcdFx0cmV0dXJuIG9iajtcblx0XHR9IFxuXHRcdHJldHVybiBudWxsO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBDYWxscyBkZXN0cm95KCkgb24gZWFjaCBtYW5hZ2VkIG9iamVjdCwgdGhlbiByZW1vdmVzIHJlZmVyZW5jZXMgdG8gdGhlc2Ugb2JqZWN0c1xuXHQgKiBhbmQgdGhlIEdMIHJlbmRlcmluZyBjb250ZXh0LiBUaGlzIGFsc28gcmVtb3ZlcyByZWZlcmVuY2VzIHRvIHRoZSB2aWV3IGFuZCBzZXRzXG5cdCAqIHRoZSBjb250ZXh0J3Mgd2lkdGggYW5kIGhlaWdodCB0byB6ZXJvLlxuXHQgKlxuXHQgKiBBdHRlbXB0aW5nIHRvIHVzZSB0aGlzIFdlYkdMQ29udGV4dCBvciB0aGUgR0wgcmVuZGVyaW5nIGNvbnRleHQgYWZ0ZXIgZGVzdHJveWluZyBpdFxuXHQgKiB3aWxsIGxlYWQgdG8gdW5kZWZpbmVkIGJlaGF2aW91ci5cblx0ICovXG5cdGRlc3Ryb3k6IGZ1bmN0aW9uKCkge1xuXHRcdGZvciAodmFyIGk9MDsgaTx0aGlzLm1hbmFnZWRPYmplY3RzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHR2YXIgb2JqID0gdGhpcy5tYW5hZ2VkT2JqZWN0c1tpXTtcblx0XHRcdGlmIChvYmogJiYgdHlwZW9mIG9iai5kZXN0cm95ID09PSBcImZ1bmN0aW9uXCIpXG5cdFx0XHRcdG9iai5kZXN0cm95KCk7XG5cdFx0fVxuXHRcdHRoaXMubWFuYWdlZE9iamVjdHMubGVuZ3RoID0gMDtcblx0XHR0aGlzLnZhbGlkID0gZmFsc2U7XG5cdFx0dGhpcy5nbCA9IG51bGw7XG5cdFx0dGhpcy52aWV3ID0gbnVsbDtcblx0XHR0aGlzLndpZHRoID0gdGhpcy5oZWlnaHQgPSAwO1xuXHR9LFxuXG5cdF9jb250ZXh0TG9zdDogZnVuY3Rpb24oZXYpIHtcblx0XHQvL2FsbCB0ZXh0dXJlcy9zaGFkZXJzL2J1ZmZlcnMvRkJPcyBoYXZlIGJlZW4gZGVsZXRlZC4uLiBcblx0XHQvL3dlIG5lZWQgdG8gcmUtY3JlYXRlIHRoZW0gb24gcmVzdG9yZVxuXHRcdHRoaXMudmFsaWQgPSBmYWxzZTtcblxuXHRcdHRoaXMubG9zdC5kaXNwYXRjaCh0aGlzKTtcblx0fSxcblxuXHRfY29udGV4dFJlc3RvcmVkOiBmdW5jdGlvbihldikge1xuXHRcdC8vZmlyc3QsIGluaXRpYWxpemUgdGhlIEdMIGNvbnRleHQgYWdhaW5cblx0XHR0aGlzLl9pbml0Q29udGV4dCgpO1xuXG5cdFx0Ly9ub3cgd2UgcmVjcmVhdGUgb3VyIHNoYWRlcnMgYW5kIHRleHR1cmVzXG5cdFx0Zm9yICh2YXIgaT0wOyBpPHRoaXMubWFuYWdlZE9iamVjdHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdHRoaXMubWFuYWdlZE9iamVjdHNbaV0uY3JlYXRlKCk7XG5cdFx0fVxuXG5cdFx0Ly91cGRhdGUgR0wgdmlld3BvcnRcblx0XHR0aGlzLnJlc2l6ZSh0aGlzLndpZHRoLCB0aGlzLmhlaWdodCk7XG5cblx0XHR0aGlzLnJlc3RvcmVkLmRpc3BhdGNoKHRoaXMpO1xuXHR9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBXZWJHTENvbnRleHQ7IiwidmFyIENsYXNzID0gcmVxdWlyZSgna2xhc3NlJyk7XG52YXIgVGV4dHVyZSA9IHJlcXVpcmUoJy4uL1RleHR1cmUnKTtcblxuXG52YXIgRnJhbWVCdWZmZXIgPSBuZXcgQ2xhc3Moe1xuXG5cdC8qKlxuXHQgKiBDcmVhdGVzIGEgbmV3IEZyYW1lIEJ1ZmZlciBPYmplY3Qgd2l0aCB0aGUgZ2l2ZW4gd2lkdGggYW5kIGhlaWdodC5cblx0ICpcblx0ICogSWYgd2lkdGggYW5kIGhlaWdodCBhcmUgbm9uLW51bWJlcnMsIHRoaXMgbWV0aG9kIGV4cGVjdHMgdGhlXG5cdCAqIGZpcnN0IHBhcmFtZXRlciB0byBiZSBhIFRleHR1cmUgb2JqZWN0IHdoaWNoIHNob3VsZCBiZSBhY3RlZCB1cG9uLiBcblx0ICogSW4gdGhpcyBjYXNlLCB0aGUgRnJhbWVCdWZmZXIgZG9lcyBub3QgXCJvd25cIiB0aGUgdGV4dHVyZSwgYW5kIHNvIGl0XG5cdCAqIHdvbid0IGRpc3Bvc2Ugb2YgaXQgdXBvbiBkZXN0cnVjdGlvbi4gVGhpcyBpcyBhbiBhZHZhbmNlZCB2ZXJzaW9uIG9mIHRoZVxuXHQgKiBjb25zdHJ1Y3RvciB0aGF0IGFzc3VtZXMgdGhlIHVzZXIgaXMgZ2l2aW5nIHVzIGEgdmFsaWQgVGV4dHVyZSB0aGF0IGNhbiBiZSBib3VuZCAoaS5lLlxuXHQgKiBubyBhc3luYyBJbWFnZSB0ZXh0dXJlcykuXG5cdCAqXG5cdCAqIEBjbGFzcyAgRnJhbWVCdWZmZXJcblx0ICogQGNvbnN0cnVjdG9yXG5cdCAqIEBwYXJhbSAge1t0eXBlXX0gd2lkdGggIFtkZXNjcmlwdGlvbl1cblx0ICogQHBhcmFtICB7W3R5cGVdfSBoZWlnaHQgW2Rlc2NyaXB0aW9uXVxuXHQgKiBAcGFyYW0gIHtbdHlwZV19IGZpbHRlciBbZGVzY3JpcHRpb25dXG5cdCAqIEByZXR1cm4ge1t0eXBlXX0gICAgICAgIFtkZXNjcmlwdGlvbl1cblx0ICovXG5cdGluaXRpYWxpemU6IGZ1bmN0aW9uIEZyYW1lQnVmZmVyKGNvbnRleHQsIHdpZHRoLCBoZWlnaHQsIGZvcm1hdCkgeyAvL1RPRE86IGRlcHRoIGNvbXBvbmVudFxuXHRcdGlmICh0eXBlb2YgY29udGV4dCAhPT0gXCJvYmplY3RcIilcblx0XHRcdHRocm93IFwiR0wgY29udGV4dCBub3Qgc3BlY2lmaWVkIHRvIEZyYW1lQnVmZmVyXCI7XG5cdFxuXG5cdFx0LyoqXG5cdFx0ICogVGhlIHVuZGVybHlpbmcgSUQgb2YgdGhlIEdMIGZyYW1lIGJ1ZmZlciBvYmplY3QuXG5cdFx0ICpcblx0XHQgKiBAcHJvcGVydHkge1dlYkdMRnJhbWVidWZmZXJ9IGlkXG5cdFx0ICovXHRcdFxuXHRcdHRoaXMuaWQgPSBudWxsO1xuXG5cdFx0LyoqXG5cdFx0ICogVGhlIFdlYkdMQ29udGV4dCBiYWNrZWQgYnkgdGhpcyBmcmFtZSBidWZmZXIuXG5cdFx0ICpcblx0XHQgKiBAcHJvcGVydHkge1dlYkdMQ29udGV4dH0gY29udGV4dFxuXHRcdCAqL1xuXHRcdHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XG5cblx0XHQvKipcblx0XHQgKiBUaGUgVGV4dHVyZSBiYWNrZWQgYnkgdGhpcyBmcmFtZSBidWZmZXIuXG5cdFx0ICpcblx0XHQgKiBAcHJvcGVydHkge1RleHR1cmV9IFRleHR1cmVcblx0XHQgKi9cblx0XHQvL3RoaXMgVGV4dHVyZSBpcyBub3cgbWFuYWdlZC5cblx0XHR0aGlzLnRleHR1cmUgPSBuZXcgVGV4dHVyZShjb250ZXh0LCB3aWR0aCwgaGVpZ2h0LCBmb3JtYXQpO1xuXG5cdFx0Ly9UaGlzIGlzIG1hYW5nZWQgYnkgV2ViR0xDb250ZXh0XG5cdFx0dGhpcy5jb250ZXh0LmFkZE1hbmFnZWRPYmplY3QodGhpcyk7XG5cdFx0dGhpcy5jcmVhdGUoKTtcblx0fSxcblxuXHQvKipcblx0ICogQSByZWFkLW9ubHkgcHJvcGVydHkgd2hpY2ggcmV0dXJucyB0aGUgd2lkdGggb2YgdGhlIGJhY2tpbmcgdGV4dHVyZS4gXG5cdCAqIFxuXHQgKiBAcmVhZE9ubHlcblx0ICogQHByb3BlcnR5IHdpZHRoXG5cdCAqIEB0eXBlIHtOdW1iZXJ9XG5cdCAqL1xuXHR3aWR0aDoge1xuXHRcdGdldDogZnVuY3Rpb24oKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy50ZXh0dXJlLndpZHRoXG5cdFx0fVxuXHR9LFxuXG5cdC8qKlxuXHQgKiBBIHJlYWQtb25seSBwcm9wZXJ0eSB3aGljaCByZXR1cm5zIHRoZSBoZWlnaHQgb2YgdGhlIGJhY2tpbmcgdGV4dHVyZS4gXG5cdCAqIFxuXHQgKiBAcmVhZE9ubHlcblx0ICogQHByb3BlcnR5IGhlaWdodFxuXHQgKiBAdHlwZSB7TnVtYmVyfVxuXHQgKi9cblx0aGVpZ2h0OiB7XG5cdFx0Z2V0OiBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiB0aGlzLnRleHR1cmUuaGVpZ2h0O1xuXHRcdH1cblx0fSxcblxuXG5cdC8qKlxuXHQgKiBDYWxsZWQgZHVyaW5nIGluaXRpYWxpemF0aW9uIHRvIHNldHVwIHRoZSBmcmFtZSBidWZmZXI7IGFsc28gY2FsbGVkIG9uXG5cdCAqIGNvbnRleHQgcmVzdG9yZS4gVXNlcnMgd2lsbCBub3QgbmVlZCB0byBjYWxsIHRoaXMgZGlyZWN0bHkuXG5cdCAqIFxuXHQgKiBAbWV0aG9kIGNyZWF0ZVxuXHQgKi9cblx0Y3JlYXRlOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLmdsID0gdGhpcy5jb250ZXh0LmdsOyBcblx0XHR2YXIgZ2wgPSB0aGlzLmdsO1xuXG5cdFx0dmFyIHRleCA9IHRoaXMudGV4dHVyZTtcblxuXHRcdC8vd2UgYXNzdW1lIHRoZSB0ZXh0dXJlIGhhcyBhbHJlYWR5IGhhZCBjcmVhdGUoKSBjYWxsZWQgb24gaXRcblx0XHQvL3NpbmNlIGl0IHdhcyBhZGRlZCBhcyBhIG1hbmFnZWQgb2JqZWN0IHByaW9yIHRvIHRoaXMgRnJhbWVCdWZmZXJcblx0XHR0ZXguYmluZCgpO1xuIFxuXHRcdHRoaXMuaWQgPSBnbC5jcmVhdGVGcmFtZWJ1ZmZlcigpO1xuXHRcdGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgdGhpcy5pZCk7XG5cblx0XHRnbC5mcmFtZWJ1ZmZlclRleHR1cmUyRChnbC5GUkFNRUJVRkZFUiwgZ2wuQ09MT1JfQVRUQUNITUVOVDAsIHRleC50YXJnZXQsIHRleC5pZCwgMCk7XG5cblx0XHR2YXIgcmVzdWx0ID0gZ2wuY2hlY2tGcmFtZWJ1ZmZlclN0YXR1cyhnbC5GUkFNRUJVRkZFUik7XG5cdFx0aWYgKHJlc3VsdCAhPSBnbC5GUkFNRUJVRkZFUl9DT01QTEVURSkge1xuXHRcdFx0dGhpcy5kZXN0cm95KCk7IC8vZGVzdHJveSBvdXIgcmVzb3VyY2VzIGJlZm9yZSBsZWF2aW5nIHRoaXMgZnVuY3Rpb24uLlxuXG5cdFx0XHR2YXIgZXJyID0gXCJGcmFtZWJ1ZmZlciBub3QgY29tcGxldGVcIjtcblx0XHRcdHN3aXRjaCAocmVzdWx0KSB7XG5cdFx0XHRcdGNhc2UgZ2wuRlJBTUVCVUZGRVJfVU5TVVBQT1JURUQ6XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGVyciArIFwiOiB1bnN1cHBvcnRlZFwiKTtcblx0XHRcdFx0Y2FzZSBnbC5JTkNPTVBMRVRFX0RJTUVOU0lPTlM6XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGVyciArIFwiOiBpbmNvbXBsZXRlIGRpbWVuc2lvbnNcIik7XG5cdFx0XHRcdGNhc2UgZ2wuSU5DT01QTEVURV9BVFRBQ0hNRU5UOlxuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcihlcnIgKyBcIjogaW5jb21wbGV0ZSBhdHRhY2htZW50XCIpO1xuXHRcdFx0XHRjYXNlIGdsLklOQ09NUExFVEVfTUlTU0lOR19BVFRBQ0hNRU5UOlxuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcihlcnIgKyBcIjogbWlzc2luZyBhdHRhY2htZW50XCIpO1xuXHRcdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcihlcnIpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRnbC5iaW5kRnJhbWVidWZmZXIoZ2wuRlJBTUVCVUZGRVIsIG51bGwpO1xuXHR9LFxuXG5cblx0LyoqXG5cdCAqIERlc3Ryb3lzIHRoaXMgZnJhbWUgYnVmZmVyLiBVc2luZyB0aGlzIG9iamVjdCBhZnRlciBkZXN0cm95aW5nIGl0IHdpbGwgaGF2ZVxuXHQgKiB1bmRlZmluZWQgcmVzdWx0cy4gXG5cdCAqIEBtZXRob2QgZGVzdHJveVxuXHQgKi9cblx0ZGVzdHJveTogZnVuY3Rpb24oKSB7XG5cdFx0dmFyIGdsID0gdGhpcy5nbDtcblxuXHRcdGlmICh0aGlzLnRleHR1cmUpXG5cdFx0XHR0aGlzLnRleHR1cmUuZGVzdHJveSgpO1xuXHRcdGlmICh0aGlzLmlkICYmIHRoaXMuZ2wpXG5cdFx0XHR0aGlzLmdsLmRlbGV0ZUZyYW1lYnVmZmVyKHRoaXMuaWQpO1xuXHRcdGlmICh0aGlzLmNvbnRleHQpXG5cdFx0XHR0aGlzLmNvbnRleHQucmVtb3ZlTWFuYWdlZE9iamVjdCh0aGlzKTtcblxuXHRcdHRoaXMuaWQgPSBudWxsO1xuXHRcdHRoaXMuZ2wgPSBudWxsO1xuXHRcdHRoaXMudGV4dHVyZSA9IG51bGw7XG5cdFx0dGhpcy5jb250ZXh0ID0gbnVsbDtcblx0fSxcblxuXHQvKipcblx0ICogQmluZHMgdGhpcyBmcmFtZWJ1ZmZlciBhbmQgc2V0cyB0aGUgdmlld3BvcnQgdG8gdGhlIGV4cGVjdGVkIHNpemUuXG5cdCAqIEBtZXRob2QgYmVnaW5cblx0ICovXG5cdGJlZ2luOiBmdW5jdGlvbigpIHtcblx0XHR2YXIgZ2wgPSB0aGlzLmdsO1xuXHRcdGdsLnZpZXdwb3J0KDAsIDAsIHRoaXMudGV4dHVyZS53aWR0aCwgdGhpcy50ZXh0dXJlLmhlaWdodCk7XG5cdFx0Z2wuYmluZEZyYW1lYnVmZmVyKGdsLkZSQU1FQlVGRkVSLCB0aGlzLmlkKTtcblx0fSxcblxuXHQvKipcblx0ICogQmluZHMgdGhlIGRlZmF1bHQgZnJhbWUgYnVmZmVyICh0aGUgc2NyZWVuKSBhbmQgc2V0cyB0aGUgdmlld3BvcnQgYmFja1xuXHQgKiB0byB0aGUgc2l6ZSBvZiB0aGUgV2ViR0xDb250ZXh0LlxuXHQgKiBcblx0ICogQG1ldGhvZCBlbmRcblx0ICovXG5cdGVuZDogZnVuY3Rpb24oKSB7XG5cdFx0dmFyIGdsID0gdGhpcy5nbDtcblx0XHRnbC52aWV3cG9ydCgwLCAwLCB0aGlzLmNvbnRleHQud2lkdGgsIHRoaXMuY29udGV4dC5oZWlnaHQpO1xuXHRcdGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgbnVsbCk7XG5cdH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEZyYW1lQnVmZmVyOyIsIi8qKlxuICogQG1vZHVsZSBrYW1pXG4gKi9cblxudmFyIENsYXNzID0gcmVxdWlyZSgna2xhc3NlJyk7XG5cbi8vVE9ETzogZGVjb3VwbGUgaW50byBWQk8gKyBJQk8gdXRpbGl0aWVzIFxuLyoqXG4gKiBBIG1lc2ggY2xhc3MgdGhhdCB3cmFwcyBWQk8gYW5kIElCTy5cbiAqXG4gKiBAY2xhc3MgIE1lc2hcbiAqL1xudmFyIE1lc2ggPSBuZXcgQ2xhc3Moe1xuXG5cblx0LyoqXG5cdCAqIEEgd3JpdGUtb25seSBwcm9wZXJ0eSB3aGljaCBzZXRzIGJvdGggdmVydGljZXMgYW5kIGluZGljZXMgXG5cdCAqIGZsYWcgdG8gZGlydHkgb3Igbm90LiBcblx0ICpcblx0ICogQHByb3BlcnR5IGRpcnR5XG5cdCAqIEB0eXBlIHtCb29sZWFufVxuXHQgKiBAd3JpdGVPbmx5XG5cdCAqL1xuXHRkaXJ0eToge1xuXHRcdHNldDogZnVuY3Rpb24odmFsKSB7XG5cdFx0XHR0aGlzLnZlcnRpY2VzRGlydHkgPSB2YWw7XG5cdFx0XHR0aGlzLmluZGljZXNEaXJ0eSA9IHZhbDtcblx0XHR9XG5cdH0sXG5cblx0LyoqXG5cdCAqIENyZWF0ZXMgYSBuZXcgTWVzaCB3aXRoIHRoZSBwcm92aWRlZCBwYXJhbWV0ZXJzLlxuXHQgKlxuXHQgKiBJZiBudW1JbmRpY2VzIGlzIDAgb3IgZmFsc3ksIG5vIGluZGV4IGJ1ZmZlciB3aWxsIGJlIHVzZWRcblx0ICogYW5kIGluZGljZXMgd2lsbCBiZSBhbiBlbXB0eSBBcnJheUJ1ZmZlciBhbmQgYSBudWxsIGluZGV4QnVmZmVyLlxuXHQgKiBcblx0ICogSWYgaXNTdGF0aWMgaXMgdHJ1ZSwgdGhlbiB2ZXJ0ZXhVc2FnZSBhbmQgaW5kZXhVc2FnZSB3aWxsXG5cdCAqIGJlIHNldCB0byBnbC5TVEFUSUNfRFJBVy4gT3RoZXJ3aXNlIHRoZXkgd2lsbCB1c2UgZ2wuRFlOQU1JQ19EUkFXLlxuXHQgKiBZb3UgbWF5IHdhbnQgdG8gYWRqdXN0IHRoZXNlIGFmdGVyIGluaXRpYWxpemF0aW9uIGZvciBmdXJ0aGVyIGNvbnRyb2wuXG5cdCAqIFxuXHQgKiBAcGFyYW0gIHtXZWJHTENvbnRleHR9ICBjb250ZXh0IHRoZSBjb250ZXh0IGZvciBtYW5hZ2VtZW50XG5cdCAqIEBwYXJhbSAge0Jvb2xlYW59IGlzU3RhdGljICAgICAgYSBoaW50IGFzIHRvIHdoZXRoZXIgdGhpcyBnZW9tZXRyeSBpcyBzdGF0aWNcblx0ICogQHBhcmFtICB7W3R5cGVdfSAgbnVtVmVydHMgICAgICBbZGVzY3JpcHRpb25dXG5cdCAqIEBwYXJhbSAge1t0eXBlXX0gIG51bUluZGljZXMgICAgW2Rlc2NyaXB0aW9uXVxuXHQgKiBAcGFyYW0gIHtbdHlwZV19ICB2ZXJ0ZXhBdHRyaWJzIFtkZXNjcmlwdGlvbl1cblx0ICogQHJldHVybiB7W3R5cGVdfSAgICAgICAgICAgICAgICBbZGVzY3JpcHRpb25dXG5cdCAqL1xuXHRpbml0aWFsaXplOiBmdW5jdGlvbiBNZXNoKGNvbnRleHQsIGlzU3RhdGljLCBudW1WZXJ0cywgbnVtSW5kaWNlcywgdmVydGV4QXR0cmlicykge1xuXHRcdGlmICh0eXBlb2YgY29udGV4dCAhPT0gXCJvYmplY3RcIilcblx0XHRcdHRocm93IFwiR0wgY29udGV4dCBub3Qgc3BlY2lmaWVkIHRvIE1lc2hcIjtcblx0XHRpZiAoIW51bVZlcnRzKVxuXHRcdFx0dGhyb3cgXCJudW1WZXJ0cyBub3Qgc3BlY2lmaWVkLCBtdXN0IGJlID4gMFwiO1xuXG5cdFx0dGhpcy5jb250ZXh0ID0gY29udGV4dDtcblx0XHR0aGlzLmdsID0gY29udGV4dC5nbDtcblx0XHRcblx0XHR0aGlzLm51bVZlcnRzID0gbnVsbDtcblx0XHR0aGlzLm51bUluZGljZXMgPSBudWxsO1xuXHRcdFxuXHRcdHRoaXMudmVydGljZXMgPSBudWxsO1xuXHRcdHRoaXMuaW5kaWNlcyA9IG51bGw7XG5cdFx0dGhpcy52ZXJ0ZXhCdWZmZXIgPSBudWxsO1xuXHRcdHRoaXMuaW5kZXhCdWZmZXIgPSBudWxsO1xuXG5cdFx0dGhpcy52ZXJ0aWNlc0RpcnR5ID0gdHJ1ZTtcblx0XHR0aGlzLmluZGljZXNEaXJ0eSA9IHRydWU7XG5cdFx0dGhpcy5pbmRleFVzYWdlID0gbnVsbDtcblx0XHR0aGlzLnZlcnRleFVzYWdlID0gbnVsbDtcblxuXHRcdC8qKiBcblx0XHQgKiBAcHJvcGVydHlcblx0XHQgKiBAcHJpdmF0ZVxuXHRcdCAqL1xuXHRcdHRoaXMuX3ZlcnRleEF0dHJpYnMgPSBudWxsO1xuXG5cdFx0LyoqIFxuXHRcdCAqIFRoZSBzdHJpZGUgZm9yIG9uZSB2ZXJ0ZXggX2luIGJ5dGVzXy4gXG5cdFx0ICogXG5cdFx0ICogQHByb3BlcnR5IHtOdW1iZXJ9IHZlcnRleFN0cmlkZVxuXHRcdCAqL1xuXHRcdHRoaXMudmVydGV4U3RyaWRlID0gbnVsbDtcblxuXHRcdHRoaXMubnVtVmVydHMgPSBudW1WZXJ0cztcblx0XHR0aGlzLm51bUluZGljZXMgPSBudW1JbmRpY2VzIHx8IDA7XG5cdFx0dGhpcy52ZXJ0ZXhVc2FnZSA9IGlzU3RhdGljID8gdGhpcy5nbC5TVEFUSUNfRFJBVyA6IHRoaXMuZ2wuRFlOQU1JQ19EUkFXO1xuXHRcdHRoaXMuaW5kZXhVc2FnZSAgPSBpc1N0YXRpYyA/IHRoaXMuZ2wuU1RBVElDX0RSQVcgOiB0aGlzLmdsLkRZTkFNSUNfRFJBVztcblx0XHR0aGlzLl92ZXJ0ZXhBdHRyaWJzID0gdmVydGV4QXR0cmlicyB8fCBbXTtcblx0XHRcblx0XHR0aGlzLmluZGljZXNEaXJ0eSA9IHRydWU7XG5cdFx0dGhpcy52ZXJ0aWNlc0RpcnR5ID0gdHJ1ZTtcblxuXHRcdC8vZGV0ZXJtaW5lIHRoZSB2ZXJ0ZXggc3RyaWRlIGJhc2VkIG9uIGdpdmVuIGF0dHJpYnV0ZXNcblx0XHR2YXIgdG90YWxOdW1Db21wb25lbnRzID0gMDtcblx0XHRmb3IgKHZhciBpPTA7IGk8dGhpcy5fdmVydGV4QXR0cmlicy5sZW5ndGg7IGkrKylcblx0XHRcdHRvdGFsTnVtQ29tcG9uZW50cyArPSB0aGlzLl92ZXJ0ZXhBdHRyaWJzW2ldLm9mZnNldENvdW50O1xuXHRcdHRoaXMudmVydGV4U3RyaWRlID0gdG90YWxOdW1Db21wb25lbnRzICogNDsgLy8gaW4gYnl0ZXNcblxuXHRcdHRoaXMudmVydGljZXMgPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMubnVtVmVydHMpO1xuXHRcdHRoaXMuaW5kaWNlcyA9IG5ldyBVaW50MTZBcnJheSh0aGlzLm51bUluZGljZXMpO1xuXG5cdFx0Ly9hZGQgdGhpcyBWQk8gdG8gdGhlIG1hbmFnZWQgY2FjaGVcblx0XHR0aGlzLmNvbnRleHQuYWRkTWFuYWdlZE9iamVjdCh0aGlzKTtcblxuXHRcdHRoaXMuY3JlYXRlKCk7XG5cdH0sXG5cblx0Ly9yZWNyZWF0ZXMgdGhlIGJ1ZmZlcnMgb24gY29udGV4dCBsb3NzXG5cdGNyZWF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5nbCA9IHRoaXMuY29udGV4dC5nbDtcblx0XHR2YXIgZ2wgPSB0aGlzLmdsO1xuXHRcdHRoaXMudmVydGV4QnVmZmVyID0gZ2wuY3JlYXRlQnVmZmVyKCk7XG5cblx0XHQvL2lnbm9yZSBpbmRleCBidWZmZXIgaWYgd2UgaGF2ZW4ndCBzcGVjaWZpZWQgYW55XG5cdFx0dGhpcy5pbmRleEJ1ZmZlciA9IHRoaXMubnVtSW5kaWNlcyA+IDBcblx0XHRcdFx0XHQ/IGdsLmNyZWF0ZUJ1ZmZlcigpXG5cdFx0XHRcdFx0OiBudWxsO1xuXG5cdFx0dGhpcy5kaXJ0eSA9IHRydWU7XG5cdH0sXG5cblx0ZGVzdHJveTogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy52ZXJ0aWNlcyA9IG51bGw7XG5cdFx0dGhpcy5pbmRpY2VzID0gbnVsbDtcblx0XHRpZiAodGhpcy52ZXJ0ZXhCdWZmZXIgJiYgdGhpcy5nbClcblx0XHRcdHRoaXMuZ2wuZGVsZXRlQnVmZmVyKHRoaXMudmVydGV4QnVmZmVyKTtcblx0XHRpZiAodGhpcy5pbmRleEJ1ZmZlciAmJiB0aGlzLmdsKVxuXHRcdFx0dGhpcy5nbC5kZWxldGVCdWZmZXIodGhpcy5pbmRleEJ1ZmZlcik7XG5cdFx0dGhpcy52ZXJ0ZXhCdWZmZXIgPSBudWxsO1xuXHRcdHRoaXMuaW5kZXhCdWZmZXIgPSBudWxsO1xuXHRcdGlmICh0aGlzLmNvbnRleHQpXG5cdFx0XHR0aGlzLmNvbnRleHQucmVtb3ZlTWFuYWdlZE9iamVjdCh0aGlzKTtcblx0XHR0aGlzLmdsID0gbnVsbDtcblx0XHR0aGlzLmNvbnRleHQgPSBudWxsO1xuXHR9LFxuXG5cdF91cGRhdGVCdWZmZXJzOiBmdW5jdGlvbihpZ25vcmVCaW5kLCBzdWJEYXRhTGVuZ3RoKSB7XG5cdFx0dmFyIGdsID0gdGhpcy5nbDtcblxuXHRcdC8vYmluZCBvdXIgaW5kZXggZGF0YSwgaWYgd2UgaGF2ZSBhbnlcblx0XHRpZiAodGhpcy5udW1JbmRpY2VzID4gMCkge1xuXHRcdFx0aWYgKCFpZ25vcmVCaW5kKVxuXHRcdFx0XHRnbC5iaW5kQnVmZmVyKGdsLkVMRU1FTlRfQVJSQVlfQlVGRkVSLCB0aGlzLmluZGV4QnVmZmVyKTtcblxuXHRcdFx0Ly91cGRhdGUgdGhlIGluZGV4IGRhdGFcblx0XHRcdGlmICh0aGlzLmluZGljZXNEaXJ0eSkge1xuXHRcdFx0XHRnbC5idWZmZXJEYXRhKGdsLkVMRU1FTlRfQVJSQVlfQlVGRkVSLCB0aGlzLmluZGljZXMsIHRoaXMuaW5kZXhVc2FnZSk7XG5cdFx0XHRcdHRoaXMuaW5kaWNlc0RpcnR5ID0gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly9iaW5kIG91ciB2ZXJ0ZXggZGF0YVxuXHRcdGlmICghaWdub3JlQmluZClcblx0XHRcdGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCB0aGlzLnZlcnRleEJ1ZmZlcik7XG5cblx0XHQvL3VwZGF0ZSBvdXIgdmVydGV4IGRhdGFcblx0XHRpZiAodGhpcy52ZXJ0aWNlc0RpcnR5KSB7XG5cdFx0XHRpZiAoc3ViRGF0YUxlbmd0aCkge1xuXHRcdFx0XHQvLyBUT0RPOiBXaGVuIGRlY291cGxpbmcgVkJPL0lCTyBiZSBzdXJlIHRvIGdpdmUgYmV0dGVyIHN1YkRhdGEgc3VwcG9ydC4uXG5cdFx0XHRcdHZhciB2aWV3ID0gdGhpcy52ZXJ0aWNlcy5zdWJhcnJheSgwLCBzdWJEYXRhTGVuZ3RoKTtcblx0XHRcdFx0Z2wuYnVmZmVyU3ViRGF0YShnbC5BUlJBWV9CVUZGRVIsIDAsIHZpZXcpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Z2wuYnVmZmVyRGF0YShnbC5BUlJBWV9CVUZGRVIsIHRoaXMudmVydGljZXMsIHRoaXMudmVydGV4VXNhZ2UpO1x0XG5cdFx0XHR9XG5cblx0XHRcdFxuXHRcdFx0dGhpcy52ZXJ0aWNlc0RpcnR5ID0gZmFsc2U7XG5cdFx0fVxuXHR9LFxuXG5cdGRyYXc6IGZ1bmN0aW9uKHByaW1pdGl2ZVR5cGUsIGNvdW50LCBvZmZzZXQsIHN1YkRhdGFMZW5ndGgpIHtcblx0XHRpZiAoY291bnQgPT09IDApXG5cdFx0XHRyZXR1cm47XG5cblx0XHR2YXIgZ2wgPSB0aGlzLmdsO1xuXHRcdFxuXHRcdG9mZnNldCA9IG9mZnNldCB8fCAwO1xuXG5cdFx0Ly9iaW5kcyBhbmQgdXBkYXRlcyBvdXIgYnVmZmVycy4gcGFzcyBpZ25vcmVCaW5kIGFzIHRydWVcblx0XHQvL3RvIGF2b2lkIGJpbmRpbmcgdW5uZWNlc3NhcmlseVxuXHRcdHRoaXMuX3VwZGF0ZUJ1ZmZlcnModHJ1ZSwgc3ViRGF0YUxlbmd0aCk7XG5cblx0XHRpZiAodGhpcy5udW1JbmRpY2VzID4gMCkgeyBcblx0XHRcdGdsLmRyYXdFbGVtZW50cyhwcmltaXRpdmVUeXBlLCBjb3VudCwgXG5cdFx0XHRcdFx0XHRnbC5VTlNJR05FRF9TSE9SVCwgb2Zmc2V0ICogMik7IC8vKiBVaW50MTZBcnJheS5CWVRFU19QRVJfRUxFTUVOVFxuXHRcdH0gZWxzZVxuXHRcdFx0Z2wuZHJhd0FycmF5cyhwcmltaXRpdmVUeXBlLCBvZmZzZXQsIGNvdW50KTtcblx0fSxcblxuXHQvL2JpbmRzIHRoaXMgbWVzaCdzIHZlcnRleCBhdHRyaWJ1dGVzIGZvciB0aGUgZ2l2ZW4gc2hhZGVyXG5cdGJpbmQ6IGZ1bmN0aW9uKHNoYWRlcikge1xuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cblx0XHR2YXIgb2Zmc2V0ID0gMDtcblx0XHR2YXIgc3RyaWRlID0gdGhpcy52ZXJ0ZXhTdHJpZGU7XG5cblx0XHQvL2JpbmQgYW5kIHVwZGF0ZSBvdXIgdmVydGV4IGRhdGEgYmVmb3JlIGJpbmRpbmcgYXR0cmlidXRlc1xuXHRcdHRoaXMuX3VwZGF0ZUJ1ZmZlcnMoKTtcblxuXHRcdC8vZm9yIGVhY2ggYXR0cmlidHVlXG5cdFx0Zm9yICh2YXIgaT0wOyBpPHRoaXMuX3ZlcnRleEF0dHJpYnMubGVuZ3RoOyBpKyspIHtcblx0XHRcdHZhciBhID0gdGhpcy5fdmVydGV4QXR0cmlic1tpXTtcblxuXHRcdFx0Ly9sb2NhdGlvbiBvZiB0aGUgYXR0cmlidXRlXG5cdFx0XHR2YXIgbG9jID0gYS5sb2NhdGlvbiA9PT0gbnVsbCBcblx0XHRcdFx0XHQ/IHNoYWRlci5nZXRBdHRyaWJ1dGVMb2NhdGlvbihhLm5hbWUpXG5cdFx0XHRcdFx0OiBhLmxvY2F0aW9uO1xuXG5cdFx0XHQvL1RPRE86IFdlIG1heSB3YW50IHRvIHNraXAgdW5mb3VuZCBhdHRyaWJzXG5cdFx0XHQvLyBpZiAobG9jIT09MCAmJiAhbG9jKVxuXHRcdFx0Ly8gXHRjb25zb2xlLndhcm4oXCJXQVJOOlwiLCBhLm5hbWUsIFwiaXMgbm90IGVuYWJsZWRcIik7XG5cblx0XHRcdC8vZmlyc3QsIGVuYWJsZSB0aGUgdmVydGV4IGFycmF5XG5cdFx0XHRnbC5lbmFibGVWZXJ0ZXhBdHRyaWJBcnJheShsb2MpO1xuXG5cdFx0XHQvL3RoZW4gc3BlY2lmeSBvdXIgdmVydGV4IGZvcm1hdFxuXHRcdFx0Z2wudmVydGV4QXR0cmliUG9pbnRlcihsb2MsIGEubnVtQ29tcG9uZW50cywgYS50eXBlIHx8IGdsLkZMT0FULCBcblx0XHRcdFx0XHRcdFx0XHQgICBhLm5vcm1hbGl6ZSwgc3RyaWRlLCBvZmZzZXQpO1xuXG5cdFx0XHQvL2FuZCBpbmNyZWFzZSB0aGUgb2Zmc2V0Li4uXG5cdFx0XHRvZmZzZXQgKz0gYS5vZmZzZXRDb3VudCAqIDQ7IC8vaW4gYnl0ZXNcblx0XHR9XG5cdH0sXG5cblx0dW5iaW5kOiBmdW5jdGlvbihzaGFkZXIpIHtcblx0XHR2YXIgZ2wgPSB0aGlzLmdsO1xuXG5cdFx0Ly9mb3IgZWFjaCBhdHRyaWJ0dWVcblx0XHRmb3IgKHZhciBpPTA7IGk8dGhpcy5fdmVydGV4QXR0cmlicy5sZW5ndGg7IGkrKykge1xuXHRcdFx0dmFyIGEgPSB0aGlzLl92ZXJ0ZXhBdHRyaWJzW2ldO1xuXG5cdFx0XHQvL2xvY2F0aW9uIG9mIHRoZSBhdHRyaWJ1dGVcblx0XHRcdHZhciBsb2MgPSBhLmxvY2F0aW9uID09PSBudWxsIFxuXHRcdFx0XHRcdD8gc2hhZGVyLmdldEF0dHJpYnV0ZUxvY2F0aW9uKGEubmFtZSlcblx0XHRcdFx0XHQ6IGEubG9jYXRpb247XG5cblx0XHRcdC8vZmlyc3QsIGVuYWJsZSB0aGUgdmVydGV4IGFycmF5XG5cdFx0XHRnbC5kaXNhYmxlVmVydGV4QXR0cmliQXJyYXkobG9jKTtcblx0XHR9XG5cdH1cbn0pO1xuXG5NZXNoLkF0dHJpYiA9IG5ldyBDbGFzcyh7XG5cblx0bmFtZTogbnVsbCxcblx0bnVtQ29tcG9uZW50czogbnVsbCxcblx0bG9jYXRpb246IG51bGwsXG5cdHR5cGU6IG51bGwsXG5cblx0LyoqXG5cdCAqIExvY2F0aW9uIGlzIG9wdGlvbmFsIGFuZCBmb3IgYWR2YW5jZWQgdXNlcnMgdGhhdFxuXHQgKiB3YW50IHZlcnRleCBhcnJheXMgdG8gbWF0Y2ggYWNyb3NzIHNoYWRlcnMuIEFueSBub24tbnVtZXJpY2FsXG5cdCAqIHZhbHVlIHdpbGwgYmUgY29udmVydGVkIHRvIG51bGwsIGFuZCBpZ25vcmVkLiBJZiBhIG51bWVyaWNhbFxuXHQgKiB2YWx1ZSBpcyBnaXZlbiwgaXQgd2lsbCBvdmVycmlkZSB0aGUgcG9zaXRpb24gb2YgdGhpcyBhdHRyaWJ1dGVcblx0ICogd2hlbiBnaXZlbiB0byBhIG1lc2guXG5cdCAqIFxuXHQgKiBAcGFyYW0gIHtbdHlwZV19IG5hbWUgICAgICAgICAgW2Rlc2NyaXB0aW9uXVxuXHQgKiBAcGFyYW0gIHtbdHlwZV19IG51bUNvbXBvbmVudHMgW2Rlc2NyaXB0aW9uXVxuXHQgKiBAcGFyYW0gIHtbdHlwZV19IGxvY2F0aW9uICAgICAgW2Rlc2NyaXB0aW9uXVxuXHQgKiBAcmV0dXJuIHtbdHlwZV19ICAgICAgICAgICAgICAgW2Rlc2NyaXB0aW9uXVxuXHQgKi9cblx0aW5pdGlhbGl6ZTogZnVuY3Rpb24obmFtZSwgbnVtQ29tcG9uZW50cywgbG9jYXRpb24sIHR5cGUsIG5vcm1hbGl6ZSwgb2Zmc2V0Q291bnQpIHtcblx0XHR0aGlzLm5hbWUgPSBuYW1lO1xuXHRcdHRoaXMubnVtQ29tcG9uZW50cyA9IG51bUNvbXBvbmVudHM7XG5cdFx0dGhpcy5sb2NhdGlvbiA9IHR5cGVvZiBsb2NhdGlvbiA9PT0gXCJudW1iZXJcIiA/IGxvY2F0aW9uIDogbnVsbDtcblx0XHR0aGlzLnR5cGUgPSB0eXBlO1xuXHRcdHRoaXMubm9ybWFsaXplID0gQm9vbGVhbihub3JtYWxpemUpO1xuXHRcdHRoaXMub2Zmc2V0Q291bnQgPSB0eXBlb2Ygb2Zmc2V0Q291bnQgPT09IFwibnVtYmVyXCIgPyBvZmZzZXRDb3VudCA6IHRoaXMubnVtQ29tcG9uZW50cztcblx0fVxufSlcblxuXG5tb2R1bGUuZXhwb3J0cyA9IE1lc2g7IiwiLyoqXG4gKiBAbW9kdWxlIGthbWlcbiAqL1xuXG52YXIgQ2xhc3MgPSByZXF1aXJlKCdrbGFzc2UnKTtcblxuXG52YXIgU2hhZGVyUHJvZ3JhbSA9IG5ldyBDbGFzcyh7XG5cdFxuXHQvKipcblx0ICogQ3JlYXRlcyBhIG5ldyBTaGFkZXJQcm9ncmFtIGZyb20gdGhlIGdpdmVuIHNvdXJjZSwgYW5kIGFuIG9wdGlvbmFsIG1hcCBvZiBhdHRyaWJ1dGVcblx0ICogbG9jYXRpb25zIGFzIDxuYW1lLCBpbmRleD4gcGFpcnMuXG5cdCAqXG5cdCAqIF9Ob3RlOl8gQ2hyb21lIHZlcnNpb24gMzEgd2FzIGdpdmluZyBtZSBpc3N1ZXMgd2l0aCBhdHRyaWJ1dGUgbG9jYXRpb25zIC0tIHlvdSBtYXlcblx0ICogd2FudCB0byBvbWl0IHRoaXMgdG8gbGV0IHRoZSBicm93c2VyIHBpY2sgdGhlIGxvY2F0aW9ucyBmb3IgeW91Llx0XG5cdCAqXG5cdCAqIEBjbGFzcyAgU2hhZGVyUHJvZ3JhbVxuXHQgKiBAY29uc3RydWN0b3Jcblx0ICogQHBhcmFtICB7V2ViR0xDb250ZXh0fSBjb250ZXh0ICAgICAgdGhlIGNvbnRleHQgdG8gbWFuYWdlIHRoaXMgb2JqZWN0XG5cdCAqIEBwYXJhbSAge1N0cmluZ30gdmVydFNvdXJjZSAgICAgICAgIHRoZSB2ZXJ0ZXggc2hhZGVyIHNvdXJjZVxuXHQgKiBAcGFyYW0gIHtTdHJpbmd9IGZyYWdTb3VyY2UgICAgICAgICB0aGUgZnJhZ21lbnQgc2hhZGVyIHNvdXJjZVxuXHQgKiBAcGFyYW0gIHtPYmplY3R9IGF0dHJpYnV0ZUxvY2F0aW9ucyB0aGUgYXR0cmlidXRlIGxvY2F0aW9uc1xuXHQgKi9cblx0aW5pdGlhbGl6ZTogZnVuY3Rpb24gU2hhZGVyUHJvZ3JhbShjb250ZXh0LCB2ZXJ0U291cmNlLCBmcmFnU291cmNlLCBhdHRyaWJ1dGVMb2NhdGlvbnMpIHtcblx0XHRpZiAoIXZlcnRTb3VyY2UgfHwgIWZyYWdTb3VyY2UpXG5cdFx0XHR0aHJvdyBcInZlcnRleCBhbmQgZnJhZ21lbnQgc2hhZGVycyBtdXN0IGJlIGRlZmluZWRcIjtcblx0XHRpZiAodHlwZW9mIGNvbnRleHQgIT09IFwib2JqZWN0XCIpXG5cdFx0XHR0aHJvdyBcIkdMIGNvbnRleHQgbm90IHNwZWNpZmllZCB0byBTaGFkZXJQcm9ncmFtXCI7XG5cdFx0dGhpcy5jb250ZXh0ID0gY29udGV4dDtcblxuXHRcdHRoaXMudmVydFNoYWRlciA9IG51bGw7XG5cdFx0dGhpcy5mcmFnU2hhZGVyID0gbnVsbDtcblx0XHR0aGlzLnByb2dyYW0gPSBudWxsO1xuXHRcdHRoaXMubG9nID0gXCJcIjtcblxuXHRcdHRoaXMudW5pZm9ybUNhY2hlID0gbnVsbDtcblx0XHR0aGlzLmF0dHJpYnV0ZUNhY2hlID0gbnVsbDtcblxuXHRcdHRoaXMuYXR0cmlidXRlTG9jYXRpb25zID0gYXR0cmlidXRlTG9jYXRpb25zO1xuXG5cdFx0Ly9XZSB0cmltIChFQ01BU2NyaXB0NSkgc28gdGhhdCB0aGUgR0xTTCBsaW5lIG51bWJlcnMgYXJlXG5cdFx0Ly9hY2N1cmF0ZSBvbiBzaGFkZXIgbG9nXG5cdFx0dGhpcy52ZXJ0U291cmNlID0gdmVydFNvdXJjZS50cmltKCk7XG5cdFx0dGhpcy5mcmFnU291cmNlID0gZnJhZ1NvdXJjZS50cmltKCk7XG5cblx0XHQvL0FkZHMgdGhpcyBzaGFkZXIgdG8gdGhlIGNvbnRleHQsIHRvIGJlIG1hbmFnZWRcblx0XHR0aGlzLmNvbnRleHQuYWRkTWFuYWdlZE9iamVjdCh0aGlzKTtcblxuXHRcdHRoaXMuY3JlYXRlKCk7XG5cdH0sXG5cblx0LyoqIFxuXHQgKiBUaGlzIGlzIGNhbGxlZCBkdXJpbmcgdGhlIFNoYWRlclByb2dyYW0gY29uc3RydWN0b3IsXG5cdCAqIGFuZCBtYXkgbmVlZCB0byBiZSBjYWxsZWQgYWdhaW4gYWZ0ZXIgY29udGV4dCBsb3NzIGFuZCByZXN0b3JlLlxuXHQgKiBcblx0ICogQG1ldGhvZCAgY3JlYXRlXG5cdCAqL1xuXHRjcmVhdGU6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMuZ2wgPSB0aGlzLmNvbnRleHQuZ2w7XG5cdFx0dGhpcy5fY29tcGlsZVNoYWRlcnMoKTtcblx0fSxcblxuXHQvL0NvbXBpbGVzIHRoZSBzaGFkZXJzLCB0aHJvd2luZyBhbiBlcnJvciBpZiB0aGUgcHJvZ3JhbSB3YXMgaW52YWxpZC5cblx0X2NvbXBpbGVTaGFkZXJzOiBmdW5jdGlvbigpIHtcblx0XHR2YXIgZ2wgPSB0aGlzLmdsOyBcblx0XHRcblx0XHR0aGlzLmxvZyA9IFwiXCI7XG5cblx0XHR0aGlzLnZlcnRTaGFkZXIgPSB0aGlzLl9sb2FkU2hhZGVyKGdsLlZFUlRFWF9TSEFERVIsIHRoaXMudmVydFNvdXJjZSk7XG5cdFx0dGhpcy5mcmFnU2hhZGVyID0gdGhpcy5fbG9hZFNoYWRlcihnbC5GUkFHTUVOVF9TSEFERVIsIHRoaXMuZnJhZ1NvdXJjZSk7XG5cblx0XHRpZiAoIXRoaXMudmVydFNoYWRlciB8fCAhdGhpcy5mcmFnU2hhZGVyKVxuXHRcdFx0dGhyb3cgXCJFcnJvciByZXR1cm5lZCB3aGVuIGNhbGxpbmcgY3JlYXRlU2hhZGVyXCI7XG5cblx0XHR0aGlzLnByb2dyYW0gPSBnbC5jcmVhdGVQcm9ncmFtKCk7XG5cblx0XHRnbC5hdHRhY2hTaGFkZXIodGhpcy5wcm9ncmFtLCB0aGlzLnZlcnRTaGFkZXIpO1xuXHRcdGdsLmF0dGFjaFNoYWRlcih0aGlzLnByb2dyYW0sIHRoaXMuZnJhZ1NoYWRlcik7XG5cdFxuXHRcdC8vVE9ETzogVGhpcyBzZWVtcyBub3QgdG8gYmUgd29ya2luZyBvbiBteSBPU1ggLS0gbWF5YmUgYSBkcml2ZXIgYnVnP1xuXHRcdGlmICh0aGlzLmF0dHJpYnV0ZUxvY2F0aW9ucykge1xuXHRcdFx0Zm9yICh2YXIga2V5IGluIHRoaXMuYXR0cmlidXRlTG9jYXRpb25zKSB7XG5cdFx0XHRcdGlmICh0aGlzLmF0dHJpYnV0ZUxvY2F0aW9ucy5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG5cdFx0XHRcdFx0Z2wuYmluZEF0dHJpYkxvY2F0aW9uKHRoaXMucHJvZ3JhbSwgTWF0aC5mbG9vcih0aGlzLmF0dHJpYnV0ZUxvY2F0aW9uc1trZXldKSwga2V5KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGdsLmxpbmtQcm9ncmFtKHRoaXMucHJvZ3JhbSk7IFxuXG5cdFx0dGhpcy5sb2cgKz0gZ2wuZ2V0UHJvZ3JhbUluZm9Mb2codGhpcy5wcm9ncmFtKSB8fCBcIlwiO1xuXG5cdFx0aWYgKCFnbC5nZXRQcm9ncmFtUGFyYW1ldGVyKHRoaXMucHJvZ3JhbSwgZ2wuTElOS19TVEFUVVMpKSB7XG5cdFx0XHR0aHJvdyBcIkVycm9yIGxpbmtpbmcgdGhlIHNoYWRlciBwcm9ncmFtOlxcblwiXG5cdFx0XHRcdCsgdGhpcy5sb2c7XG5cdFx0fVxuXG5cdFx0dGhpcy5fZmV0Y2hVbmlmb3JtcygpO1xuXHRcdHRoaXMuX2ZldGNoQXR0cmlidXRlcygpO1xuXHR9LFxuXG5cdF9mZXRjaFVuaWZvcm1zOiBmdW5jdGlvbigpIHtcblx0XHR2YXIgZ2wgPSB0aGlzLmdsO1xuXG5cdFx0dGhpcy51bmlmb3JtQ2FjaGUgPSB7fTtcblxuXHRcdHZhciBsZW4gPSBnbC5nZXRQcm9ncmFtUGFyYW1ldGVyKHRoaXMucHJvZ3JhbSwgZ2wuQUNUSVZFX1VOSUZPUk1TKTtcblx0XHRpZiAoIWxlbikgLy9udWxsIG9yIHplcm9cblx0XHRcdHJldHVybjtcblxuXHRcdGZvciAodmFyIGk9MDsgaTxsZW47IGkrKykge1xuXHRcdFx0dmFyIGluZm8gPSBnbC5nZXRBY3RpdmVVbmlmb3JtKHRoaXMucHJvZ3JhbSwgaSk7XG5cdFx0XHRpZiAoaW5mbyA9PT0gbnVsbCkgXG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0dmFyIG5hbWUgPSBpbmZvLm5hbWU7XG5cdFx0XHR2YXIgbG9jYXRpb24gPSBnbC5nZXRVbmlmb3JtTG9jYXRpb24odGhpcy5wcm9ncmFtLCBuYW1lKTtcblx0XHRcdFxuXHRcdFx0dGhpcy51bmlmb3JtQ2FjaGVbbmFtZV0gPSB7XG5cdFx0XHRcdHNpemU6IGluZm8uc2l6ZSxcblx0XHRcdFx0dHlwZTogaW5mby50eXBlLFxuXHRcdFx0XHRsb2NhdGlvbjogbG9jYXRpb25cblx0XHRcdH07XG5cdFx0fVxuXHR9LFxuXG5cdF9mZXRjaEF0dHJpYnV0ZXM6IGZ1bmN0aW9uKCkgeyBcblx0XHR2YXIgZ2wgPSB0aGlzLmdsOyBcblxuXHRcdHRoaXMuYXR0cmlidXRlQ2FjaGUgPSB7fTtcblxuXHRcdHZhciBsZW4gPSBnbC5nZXRQcm9ncmFtUGFyYW1ldGVyKHRoaXMucHJvZ3JhbSwgZ2wuQUNUSVZFX0FUVFJJQlVURVMpO1xuXHRcdGlmICghbGVuKSAvL251bGwgb3IgemVyb1xuXHRcdFx0cmV0dXJuO1x0XG5cblx0XHRmb3IgKHZhciBpPTA7IGk8bGVuOyBpKyspIHtcblx0XHRcdHZhciBpbmZvID0gZ2wuZ2V0QWN0aXZlQXR0cmliKHRoaXMucHJvZ3JhbSwgaSk7XG5cdFx0XHRpZiAoaW5mbyA9PT0gbnVsbCkgXG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0dmFyIG5hbWUgPSBpbmZvLm5hbWU7XG5cblx0XHRcdC8vdGhlIGF0dHJpYiBsb2NhdGlvbiBpcyBhIHNpbXBsZSBpbmRleFxuXHRcdFx0dmFyIGxvY2F0aW9uID0gZ2wuZ2V0QXR0cmliTG9jYXRpb24odGhpcy5wcm9ncmFtLCBuYW1lKTtcblx0XHRcdFxuXHRcdFx0dGhpcy5hdHRyaWJ1dGVDYWNoZVtuYW1lXSA9IHtcblx0XHRcdFx0c2l6ZTogaW5mby5zaXplLFxuXHRcdFx0XHR0eXBlOiBpbmZvLnR5cGUsXG5cdFx0XHRcdGxvY2F0aW9uOiBsb2NhdGlvblxuXHRcdFx0fTtcblx0XHR9XG5cdH0sXG5cblx0X2xvYWRTaGFkZXI6IGZ1bmN0aW9uKHR5cGUsIHNvdXJjZSkge1xuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cblx0XHR2YXIgc2hhZGVyID0gZ2wuY3JlYXRlU2hhZGVyKHR5cGUpO1xuXHRcdGlmICghc2hhZGVyKSAvL3Nob3VsZCBub3Qgb2NjdXIuLi5cblx0XHRcdHJldHVybiAtMTtcblxuXHRcdGdsLnNoYWRlclNvdXJjZShzaGFkZXIsIHNvdXJjZSk7XG5cdFx0Z2wuY29tcGlsZVNoYWRlcihzaGFkZXIpO1xuXHRcdFxuXHRcdHZhciBsb2dSZXN1bHQgPSBnbC5nZXRTaGFkZXJJbmZvTG9nKHNoYWRlcikgfHwgXCJcIjtcblx0XHRpZiAobG9nUmVzdWx0KSB7XG5cdFx0XHQvL3dlIGRvIHRoaXMgc28gdGhlIHVzZXIga25vd3Mgd2hpY2ggc2hhZGVyIGhhcyB0aGUgZXJyb3Jcblx0XHRcdHZhciB0eXBlU3RyID0gKHR5cGUgPT09IGdsLlZFUlRFWF9TSEFERVIpID8gXCJ2ZXJ0ZXhcIiA6IFwiZnJhZ21lbnRcIjtcblx0XHRcdGxvZ1Jlc3VsdCA9IFwiRXJyb3IgY29tcGlsaW5nIFwiKyB0eXBlU3RyKyBcIiBzaGFkZXI6XFxuXCIrbG9nUmVzdWx0O1xuXHRcdH1cblxuXHRcdHRoaXMubG9nICs9IGxvZ1Jlc3VsdDtcblxuXHRcdGlmICghZ2wuZ2V0U2hhZGVyUGFyYW1ldGVyKHNoYWRlciwgZ2wuQ09NUElMRV9TVEFUVVMpICkge1xuXHRcdFx0dGhyb3cgdGhpcy5sb2c7XG5cdFx0fVxuXHRcdHJldHVybiBzaGFkZXI7XG5cdH0sXG5cblx0LyoqXG5cdCAqIENhbGxlZCB0byBiaW5kIHRoaXMgc2hhZGVyLiBOb3RlIHRoYXQgdGhlcmUgaXMgbm8gXCJ1bmJpbmRcIiBzaW5jZVxuXHQgKiB0ZWNobmljYWxseSBzdWNoIGEgdGhpbmcgaXMgbm90IHBvc3NpYmxlIGluIHRoZSBwcm9ncmFtbWFibGUgcGlwZWxpbmUuXG5cdCAqXG5cdCAqIFlvdSBtdXN0IGJpbmQgYSBzaGFkZXIgYmVmb3JlIHNldHRpbmdzIGl0cyB1bmlmb3Jtcy5cblx0ICogXG5cdCAqIEBtZXRob2QgYmluZFxuXHQgKi9cblx0YmluZDogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5nbC51c2VQcm9ncmFtKHRoaXMucHJvZ3JhbSk7XG5cdH0sXG5cblxuXHQvKipcblx0ICogRGVzdHJveXMgdGhpcyBzaGFkZXIgYW5kIGl0cyByZXNvdXJjZXMuIFlvdSBzaG91bGQgbm90IHRyeSB0byB1c2UgdGhpc1xuXHQgKiBhZnRlciBkZXN0cm95aW5nIGl0LlxuXHQgKiBAbWV0aG9kICBkZXN0cm95XG5cdCAqL1xuXHRkZXN0cm95OiBmdW5jdGlvbigpIHtcblx0XHRpZiAodGhpcy5jb250ZXh0KVxuXHRcdFx0dGhpcy5jb250ZXh0LnJlbW92ZU1hbmFnZWRPYmplY3QodGhpcyk7XG5cblx0XHRpZiAodGhpcy5nbCAmJiB0aGlzLnByb2dyYW0pIHtcblx0XHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cdFx0XHRnbC5kZXRhY2hTaGFkZXIodGhpcy5wcm9ncmFtLCB0aGlzLnZlcnRTaGFkZXIpO1xuXHRcdFx0Z2wuZGV0YWNoU2hhZGVyKHRoaXMucHJvZ3JhbSwgdGhpcy5mcmFnU2hhZGVyKTtcblxuXHRcdFx0Z2wuZGVsZXRlU2hhZGVyKHRoaXMudmVydFNoYWRlcik7XG5cdFx0XHRnbC5kZWxldGVTaGFkZXIodGhpcy5mcmFnU2hhZGVyKTtcblx0XHRcdGdsLmRlbGV0ZVByb2dyYW0odGhpcy5wcm9ncmFtKTtcblx0XHR9XG5cdFx0dGhpcy5hdHRyaWJ1dGVDYWNoZSA9IG51bGw7XG5cdFx0dGhpcy51bmlmb3JtQ2FjaGUgPSBudWxsO1xuXHRcdHRoaXMudmVydFNoYWRlciA9IG51bGw7XG5cdFx0dGhpcy5mcmFnU2hhZGVyID0gbnVsbDtcblx0XHR0aGlzLnByb2dyYW0gPSBudWxsO1xuXHRcdHRoaXMuZ2wgPSBudWxsO1xuXHRcdHRoaXMuY29udGV4dCA9IG51bGw7XG5cdH0sXG5cblxuXHQvKipcblx0ICogUmV0dXJucyB0aGUgY2FjaGVkIHVuaWZvcm0gaW5mbyAoc2l6ZSwgdHlwZSwgbG9jYXRpb24pLlxuXHQgKiBJZiB0aGUgdW5pZm9ybSBpcyBub3QgZm91bmQgaW4gdGhlIGNhY2hlLCBpdCBpcyBhc3N1bWVkXG5cdCAqIHRvIG5vdCBleGlzdCwgYW5kIHRoaXMgbWV0aG9kIHJldHVybnMgbnVsbC5cblx0ICpcblx0ICogVGhpcyBtYXkgcmV0dXJuIG51bGwgZXZlbiBpZiB0aGUgdW5pZm9ybSBpcyBkZWZpbmVkIGluIEdMU0w6XG5cdCAqIGlmIGl0IGlzIF9pbmFjdGl2ZV8gKGkuZS4gbm90IHVzZWQgaW4gdGhlIHByb2dyYW0pIHRoZW4gaXQgbWF5XG5cdCAqIGJlIG9wdGltaXplZCBvdXQuXG5cdCAqXG5cdCAqIEBtZXRob2QgIGdldFVuaWZvcm1JbmZvXG5cdCAqIEBwYXJhbSAge1N0cmluZ30gbmFtZSB0aGUgdW5pZm9ybSBuYW1lIGFzIGRlZmluZWQgaW4gR0xTTFxuXHQgKiBAcmV0dXJuIHtPYmplY3R9IGFuIG9iamVjdCBjb250YWluaW5nIGxvY2F0aW9uLCBzaXplLCBhbmQgdHlwZVxuXHQgKi9cblx0Z2V0VW5pZm9ybUluZm86IGZ1bmN0aW9uKG5hbWUpIHtcblx0XHRyZXR1cm4gdGhpcy51bmlmb3JtQ2FjaGVbbmFtZV0gfHwgbnVsbDsgXG5cdH0sXG5cblx0LyoqXG5cdCAqIFJldHVybnMgdGhlIGNhY2hlZCBhdHRyaWJ1dGUgaW5mbyAoc2l6ZSwgdHlwZSwgbG9jYXRpb24pLlxuXHQgKiBJZiB0aGUgYXR0cmlidXRlIGlzIG5vdCBmb3VuZCBpbiB0aGUgY2FjaGUsIGl0IGlzIGFzc3VtZWRcblx0ICogdG8gbm90IGV4aXN0LCBhbmQgdGhpcyBtZXRob2QgcmV0dXJucyBudWxsLlxuXHQgKlxuXHQgKiBUaGlzIG1heSByZXR1cm4gbnVsbCBldmVuIGlmIHRoZSBhdHRyaWJ1dGUgaXMgZGVmaW5lZCBpbiBHTFNMOlxuXHQgKiBpZiBpdCBpcyBfaW5hY3RpdmVfIChpLmUuIG5vdCB1c2VkIGluIHRoZSBwcm9ncmFtIG9yIGRpc2FibGVkKSBcblx0ICogdGhlbiBpdCBtYXkgYmUgb3B0aW1pemVkIG91dC5cblx0ICpcblx0ICogQG1ldGhvZCAgZ2V0QXR0cmlidXRlSW5mb1xuXHQgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWUgdGhlIGF0dHJpYnV0ZSBuYW1lIGFzIGRlZmluZWQgaW4gR0xTTFxuXHQgKiBAcmV0dXJuIHtvYmplY3R9IGFuIG9iamVjdCBjb250YWluaW5nIGxvY2F0aW9uLCBzaXplIGFuZCB0eXBlXG5cdCAqL1xuXHRnZXRBdHRyaWJ1dGVJbmZvOiBmdW5jdGlvbihuYW1lKSB7XG5cdFx0cmV0dXJuIHRoaXMuYXR0cmlidXRlQ2FjaGVbbmFtZV0gfHwgbnVsbDsgXG5cdH0sXG5cblxuXHQvKipcblx0ICogUmV0dXJucyB0aGUgY2FjaGVkIHVuaWZvcm0gbG9jYXRpb24gb2JqZWN0LlxuXHQgKiBJZiB0aGUgdW5pZm9ybSBpcyBub3QgZm91bmQsIHRoaXMgbWV0aG9kIHJldHVybnMgbnVsbC5cblx0ICpcblx0ICogQG1ldGhvZCAgZ2V0QXR0cmlidXRlTG9jYXRpb25cblx0ICogQHBhcmFtICB7U3RyaW5nfSBuYW1lIHRoZSB1bmlmb3JtIG5hbWUgYXMgZGVmaW5lZCBpbiBHTFNMXG5cdCAqIEByZXR1cm4ge0dMaW50fSB0aGUgbG9jYXRpb24gb2JqZWN0XG5cdCAqL1xuXHRnZXRBdHRyaWJ1dGVMb2NhdGlvbjogZnVuY3Rpb24obmFtZSkgeyAvL1RPRE86IG1ha2UgZmFzdGVyLCBkb24ndCBjYWNoZVxuXHRcdHZhciBpbmZvID0gdGhpcy5nZXRBdHRyaWJ1dGVJbmZvKG5hbWUpO1xuXHRcdHJldHVybiBpbmZvID8gaW5mby5sb2NhdGlvbiA6IG51bGw7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFJldHVybnMgdGhlIGNhY2hlZCB1bmlmb3JtIGxvY2F0aW9uIG9iamVjdCwgYXNzdW1pbmcgaXQgZXhpc3RzXG5cdCAqIGFuZCBpcyBhY3RpdmUuIE5vdGUgdGhhdCB1bmlmb3JtcyBtYXkgYmUgaW5hY3RpdmUgaWYgXG5cdCAqIHRoZSBHTFNMIGNvbXBpbGVyIGRlZW1lZCB0aGVtIHVudXNlZC5cblx0ICpcblx0ICogQG1ldGhvZCAgZ2V0VW5pZm9ybUxvY2F0aW9uXG5cdCAqIEBwYXJhbSAge1N0cmluZ30gbmFtZSB0aGUgdW5pZm9ybSBuYW1lIGFzIGRlZmluZWQgaW4gR0xTTFxuXHQgKiBAcmV0dXJuIHtXZWJHTFVuaWZvcm1Mb2NhdGlvbn0gdGhlIGxvY2F0aW9uIG9iamVjdFxuXHQgKi9cblx0Z2V0VW5pZm9ybUxvY2F0aW9uOiBmdW5jdGlvbihuYW1lKSB7XG5cdFx0dmFyIGluZm8gPSB0aGlzLmdldFVuaWZvcm1JbmZvKG5hbWUpO1xuXHRcdHJldHVybiBpbmZvID8gaW5mby5sb2NhdGlvbiA6IG51bGw7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgdW5pZm9ybSBpcyBhY3RpdmUgYW5kIGZvdW5kIGluIHRoaXNcblx0ICogY29tcGlsZWQgcHJvZ3JhbS4gTm90ZSB0aGF0IHVuaWZvcm1zIG1heSBiZSBpbmFjdGl2ZSBpZiBcblx0ICogdGhlIEdMU0wgY29tcGlsZXIgZGVlbWVkIHRoZW0gdW51c2VkLlxuXHQgKlxuXHQgKiBAbWV0aG9kICBoYXNVbmlmb3JtXG5cdCAqIEBwYXJhbSAge1N0cmluZ30gIG5hbWUgdGhlIHVuaWZvcm0gbmFtZVxuXHQgKiBAcmV0dXJuIHtCb29sZWFufSB0cnVlIGlmIHRoZSB1bmlmb3JtIGlzIGZvdW5kIGFuZCBhY3RpdmVcblx0ICovXG5cdGhhc1VuaWZvcm06IGZ1bmN0aW9uKG5hbWUpIHtcblx0XHRyZXR1cm4gdGhpcy5nZXRVbmlmb3JtSW5mbyhuYW1lKSAhPT0gbnVsbDtcblx0fSxcblxuXHQvKipcblx0ICogUmV0dXJucyB0cnVlIGlmIHRoZSBhdHRyaWJ1dGUgaXMgYWN0aXZlIGFuZCBmb3VuZCBpbiB0aGlzXG5cdCAqIGNvbXBpbGVkIHByb2dyYW0uXG5cdCAqXG5cdCAqIEBtZXRob2QgIGhhc0F0dHJpYnV0ZVxuXHQgKiBAcGFyYW0gIHtTdHJpbmd9ICBuYW1lIHRoZSBhdHRyaWJ1dGUgbmFtZVxuXHQgKiBAcmV0dXJuIHtCb29sZWFufSB0cnVlIGlmIHRoZSBhdHRyaWJ1dGUgaXMgZm91bmQgYW5kIGFjdGl2ZVxuXHQgKi9cblx0aGFzQXR0cmlidXRlOiBmdW5jdGlvbihuYW1lKSB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0QXR0cmlidXRlSW5mbyhuYW1lKSAhPT0gbnVsbDtcblx0fSxcblxuXHQvKipcblx0ICogUmV0dXJucyB0aGUgdW5pZm9ybSB2YWx1ZSBieSBuYW1lLlxuXHQgKlxuXHQgKiBAbWV0aG9kICBnZXRVbmlmb3JtXG5cdCAqIEBwYXJhbSAge1N0cmluZ30gbmFtZSB0aGUgdW5pZm9ybSBuYW1lIGFzIGRlZmluZWQgaW4gR0xTTFxuXHQgKiBAcmV0dXJuIHthbnl9IFRoZSB2YWx1ZSBvZiB0aGUgV2ViR0wgdW5pZm9ybVxuXHQgKi9cblx0Z2V0VW5pZm9ybTogZnVuY3Rpb24obmFtZSkge1xuXHRcdHJldHVybiB0aGlzLmdsLmdldFVuaWZvcm0odGhpcy5wcm9ncmFtLCB0aGlzLmdldFVuaWZvcm1Mb2NhdGlvbihuYW1lKSk7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFJldHVybnMgdGhlIHVuaWZvcm0gdmFsdWUgYXQgdGhlIHNwZWNpZmllZCBXZWJHTFVuaWZvcm1Mb2NhdGlvbi5cblx0ICpcblx0ICogQG1ldGhvZCAgZ2V0VW5pZm9ybUF0XG5cdCAqIEBwYXJhbSAge1dlYkdMVW5pZm9ybUxvY2F0aW9ufSBsb2NhdGlvbiB0aGUgbG9jYXRpb24gb2JqZWN0XG5cdCAqIEByZXR1cm4ge2FueX0gVGhlIHZhbHVlIG9mIHRoZSBXZWJHTCB1bmlmb3JtXG5cdCAqL1xuXHRnZXRVbmlmb3JtQXQ6IGZ1bmN0aW9uKGxvY2F0aW9uKSB7XG5cdFx0cmV0dXJuIHRoaXMuZ2wuZ2V0VW5pZm9ybSh0aGlzLnByb2dyYW0sIGxvY2F0aW9uKTtcblx0fSxcblxuXHQvKipcblx0ICogQSBjb252ZW5pZW5jZSBtZXRob2QgdG8gc2V0IHVuaWZvcm1pIGZyb20gdGhlIGdpdmVuIGFyZ3VtZW50cy5cblx0ICogV2UgZGV0ZXJtaW5lIHdoaWNoIEdMIGNhbGwgdG8gbWFrZSBiYXNlZCBvbiB0aGUgbnVtYmVyIG9mIGFyZ3VtZW50c1xuXHQgKiBwYXNzZWQuIEZvciBleGFtcGxlLCBgc2V0VW5pZm9ybWkoXCJ2YXJcIiwgMCwgMSlgIG1hcHMgdG8gYGdsLnVuaWZvcm0yaWAuXG5cdCAqIFxuXHQgKiBAbWV0aG9kICBzZXRVbmlmb3JtaVxuXHQgKiBAcGFyYW0ge1N0cmluZ30gbmFtZSAgICAgICAgXHRcdHRoZSBuYW1lIG9mIHRoZSB1bmlmb3JtXG5cdCAqIEBwYXJhbSB7R0xpbnR9IHggIHRoZSB4IGNvbXBvbmVudCBmb3IgaW50c1xuXHQgKiBAcGFyYW0ge0dMaW50fSB5ICB0aGUgeSBjb21wb25lbnQgZm9yIGl2ZWMyXG5cdCAqIEBwYXJhbSB7R0xpbnR9IHogIHRoZSB6IGNvbXBvbmVudCBmb3IgaXZlYzNcblx0ICogQHBhcmFtIHtHTGludH0gdyAgdGhlIHcgY29tcG9uZW50IGZvciBpdmVjNFxuXHQgKi9cblx0c2V0VW5pZm9ybWk6IGZ1bmN0aW9uKG5hbWUsIHgsIHksIHosIHcpIHtcblx0XHQndXNlIHN0cmljdCc7XG5cdFx0dmFyIGdsID0gdGhpcy5nbDtcblx0XHR2YXIgbG9jID0gdGhpcy5nZXRVbmlmb3JtTG9jYXRpb24obmFtZSk7XG5cdFx0aWYgKGxvYyA9PT0gbnVsbClcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcblx0XHRcdGNhc2UgMjogZ2wudW5pZm9ybTFpKGxvYywgeCk7IHJldHVybiB0cnVlO1xuXHRcdFx0Y2FzZSAzOiBnbC51bmlmb3JtMmkobG9jLCB4LCB5KTsgcmV0dXJuIHRydWU7XG5cdFx0XHRjYXNlIDQ6IGdsLnVuaWZvcm0zaShsb2MsIHgsIHksIHopOyByZXR1cm4gdHJ1ZTtcblx0XHRcdGNhc2UgNTogZ2wudW5pZm9ybTRpKGxvYywgeCwgeSwgeiwgdyk7IHJldHVybiB0cnVlO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0dGhyb3cgXCJpbnZhbGlkIGFyZ3VtZW50cyB0byBzZXRVbmlmb3JtaVwiOyBcblx0XHR9XG5cdH0sXG5cblx0LyoqXG5cdCAqIEEgY29udmVuaWVuY2UgbWV0aG9kIHRvIHNldCB1bmlmb3JtZiBmcm9tIHRoZSBnaXZlbiBhcmd1bWVudHMuXG5cdCAqIFdlIGRldGVybWluZSB3aGljaCBHTCBjYWxsIHRvIG1ha2UgYmFzZWQgb24gdGhlIG51bWJlciBvZiBhcmd1bWVudHNcblx0ICogcGFzc2VkLiBGb3IgZXhhbXBsZSwgYHNldFVuaWZvcm1mKFwidmFyXCIsIDAsIDEpYCBtYXBzIHRvIGBnbC51bmlmb3JtMmZgLlxuXHQgKiBcblx0ICogQG1ldGhvZCAgc2V0VW5pZm9ybWZcblx0ICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgICAgICAgIFx0XHR0aGUgbmFtZSBvZiB0aGUgdW5pZm9ybVxuXHQgKiBAcGFyYW0ge0dMZmxvYXR9IHggIHRoZSB4IGNvbXBvbmVudCBmb3IgZmxvYXRzXG5cdCAqIEBwYXJhbSB7R0xmbG9hdH0geSAgdGhlIHkgY29tcG9uZW50IGZvciB2ZWMyXG5cdCAqIEBwYXJhbSB7R0xmbG9hdH0geiAgdGhlIHogY29tcG9uZW50IGZvciB2ZWMzXG5cdCAqIEBwYXJhbSB7R0xmbG9hdH0gdyAgdGhlIHcgY29tcG9uZW50IGZvciB2ZWM0XG5cdCAqL1xuXHRzZXRVbmlmb3JtZjogZnVuY3Rpb24obmFtZSwgeCwgeSwgeiwgdykge1xuXHRcdCd1c2Ugc3RyaWN0Jztcblx0XHR2YXIgZ2wgPSB0aGlzLmdsO1xuXHRcdHZhciBsb2MgPSB0aGlzLmdldFVuaWZvcm1Mb2NhdGlvbihuYW1lKTtcblx0XHRpZiAobG9jID09PSBudWxsKVxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuXHRcdFx0Y2FzZSAyOiBnbC51bmlmb3JtMWYobG9jLCB4KTsgcmV0dXJuIHRydWU7XG5cdFx0XHRjYXNlIDM6IGdsLnVuaWZvcm0yZihsb2MsIHgsIHkpOyByZXR1cm4gdHJ1ZTtcblx0XHRcdGNhc2UgNDogZ2wudW5pZm9ybTNmKGxvYywgeCwgeSwgeik7IHJldHVybiB0cnVlO1xuXHRcdFx0Y2FzZSA1OiBnbC51bmlmb3JtNGYobG9jLCB4LCB5LCB6LCB3KTsgcmV0dXJuIHRydWU7XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHR0aHJvdyBcImludmFsaWQgYXJndW1lbnRzIHRvIHNldFVuaWZvcm1mXCI7IFxuXHRcdH1cblx0fSxcblxuXHQvL0kgZ3Vlc3Mgd2Ugd29uJ3Qgc3VwcG9ydCBzZXF1ZW5jZTxHTGZsb2F0PiAuLiB3aGF0ZXZlciB0aGF0IGlzID8/XG5cdFxuXG5cdC8vLy8vIFxuXHRcblx0LyoqXG5cdCAqIEEgY29udmVuaWVuY2UgbWV0aG9kIHRvIHNldCB1bmlmb3JtTmZ2IGZyb20gdGhlIGdpdmVuIEFycmF5QnVmZmVyLlxuXHQgKiBXZSBkZXRlcm1pbmUgd2hpY2ggR0wgY2FsbCB0byBtYWtlIGJhc2VkIG9uIHRoZSBsZW5ndGggb2YgdGhlIGFycmF5IFxuXHQgKiBidWZmZXIgKGZvciAxLTQgY29tcG9uZW50IHZlY3RvcnMgc3RvcmVkIGluIGEgRmxvYXQzMkFycmF5KS4gVG8gdXNlXG5cdCAqIHRoaXMgbWV0aG9kIHRvIHVwbG9hZCBkYXRhIHRvIHVuaWZvcm0gYXJyYXlzLCB5b3UgbmVlZCB0byBzcGVjaWZ5IHRoZVxuXHQgKiAnY291bnQnIHBhcmFtZXRlcjsgaS5lLiB0aGUgZGF0YSB0eXBlIHlvdSBhcmUgdXNpbmcgZm9yIHRoYXQgYXJyYXkuIElmXG5cdCAqIHNwZWNpZmllZCwgdGhpcyB3aWxsIGRpY3RhdGUgd2hldGhlciB0byBjYWxsIHVuaWZvcm0xZnYsIHVuaWZvcm0yZnYsIGV0Yy5cblx0ICpcblx0ICogQG1ldGhvZCAgc2V0VW5pZm9ybWZ2XG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lICAgICAgICBcdFx0dGhlIG5hbWUgb2YgdGhlIHVuaWZvcm1cblx0ICogQHBhcmFtIHtBcnJheUJ1ZmZlcn0gYXJyYXlCdWZmZXIgdGhlIGFycmF5IGJ1ZmZlclxuXHQgKiBAcGFyYW0ge051bWJlcn0gY291bnQgICAgICAgICAgICBvcHRpb25hbCwgdGhlIGV4cGxpY2l0IGRhdGEgdHlwZSBjb3VudCwgZS5nLiAyIGZvciB2ZWMyXG5cdCAqL1xuXHRzZXRVbmlmb3JtZnY6IGZ1bmN0aW9uKG5hbWUsIGFycmF5QnVmZmVyLCBjb3VudCkge1xuXHRcdCd1c2Ugc3RyaWN0Jztcblx0XHRjb3VudCA9IGNvdW50IHx8IGFycmF5QnVmZmVyLmxlbmd0aDtcblx0XHR2YXIgZ2wgPSB0aGlzLmdsO1xuXHRcdHZhciBsb2MgPSB0aGlzLmdldFVuaWZvcm1Mb2NhdGlvbihuYW1lKTtcblx0XHRpZiAobG9jID09PSBudWxsKVxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdHN3aXRjaCAoY291bnQpIHtcblx0XHRcdGNhc2UgMTogZ2wudW5pZm9ybTFmdihsb2MsIGFycmF5QnVmZmVyKTsgcmV0dXJuIHRydWU7XG5cdFx0XHRjYXNlIDI6IGdsLnVuaWZvcm0yZnYobG9jLCBhcnJheUJ1ZmZlcik7IHJldHVybiB0cnVlO1xuXHRcdFx0Y2FzZSAzOiBnbC51bmlmb3JtM2Z2KGxvYywgYXJyYXlCdWZmZXIpOyByZXR1cm4gdHJ1ZTtcblx0XHRcdGNhc2UgNDogZ2wudW5pZm9ybTRmdihsb2MsIGFycmF5QnVmZmVyKTsgcmV0dXJuIHRydWU7XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHR0aHJvdyBcImludmFsaWQgYXJndW1lbnRzIHRvIHNldFVuaWZvcm1mXCI7IFxuXHRcdH1cblx0fSxcblxuXHQvKipcblx0ICogQSBjb252ZW5pZW5jZSBtZXRob2QgdG8gc2V0IHVuaWZvcm1OaXYgZnJvbSB0aGUgZ2l2ZW4gQXJyYXlCdWZmZXIuXG5cdCAqIFdlIGRldGVybWluZSB3aGljaCBHTCBjYWxsIHRvIG1ha2UgYmFzZWQgb24gdGhlIGxlbmd0aCBvZiB0aGUgYXJyYXkgXG5cdCAqIGJ1ZmZlciAoZm9yIDEtNCBjb21wb25lbnQgdmVjdG9ycyBzdG9yZWQgaW4gYSBpbnQgYXJyYXkpLiBUbyB1c2Vcblx0ICogdGhpcyBtZXRob2QgdG8gdXBsb2FkIGRhdGEgdG8gdW5pZm9ybSBhcnJheXMsIHlvdSBuZWVkIHRvIHNwZWNpZnkgdGhlXG5cdCAqICdjb3VudCcgcGFyYW1ldGVyOyBpLmUuIHRoZSBkYXRhIHR5cGUgeW91IGFyZSB1c2luZyBmb3IgdGhhdCBhcnJheS4gSWZcblx0ICogc3BlY2lmaWVkLCB0aGlzIHdpbGwgZGljdGF0ZSB3aGV0aGVyIHRvIGNhbGwgdW5pZm9ybTFmdiwgdW5pZm9ybTJmdiwgZXRjLlxuXHQgKlxuXHQgKiBAbWV0aG9kICBzZXRVbmlmb3JtaXZcblx0ICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgICAgICAgIFx0XHR0aGUgbmFtZSBvZiB0aGUgdW5pZm9ybVxuXHQgKiBAcGFyYW0ge0FycmF5QnVmZmVyfSBhcnJheUJ1ZmZlciB0aGUgYXJyYXkgYnVmZmVyXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBjb3VudCAgICAgICAgICAgIG9wdGlvbmFsLCB0aGUgZXhwbGljaXQgZGF0YSB0eXBlIGNvdW50LCBlLmcuIDIgZm9yIGl2ZWMyXG5cdCAqL1xuXHRzZXRVbmlmb3JtaXY6IGZ1bmN0aW9uKG5hbWUsIGFycmF5QnVmZmVyLCBjb3VudCkge1xuXHRcdCd1c2Ugc3RyaWN0Jztcblx0XHRjb3VudCA9IGNvdW50IHx8IGFycmF5QnVmZmVyLmxlbmd0aDtcblx0XHR2YXIgZ2wgPSB0aGlzLmdsO1xuXHRcdHZhciBsb2MgPSB0aGlzLmdldFVuaWZvcm1Mb2NhdGlvbihuYW1lKTtcblx0XHRpZiAobG9jID09PSBudWxsKVxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdHN3aXRjaCAoY291bnQpIHtcblx0XHRcdGNhc2UgMTogZ2wudW5pZm9ybTFpdihsb2MsIGFycmF5QnVmZmVyKTsgcmV0dXJuIHRydWU7XG5cdFx0XHRjYXNlIDI6IGdsLnVuaWZvcm0yaXYobG9jLCBhcnJheUJ1ZmZlcik7IHJldHVybiB0cnVlO1xuXHRcdFx0Y2FzZSAzOiBnbC51bmlmb3JtM2l2KGxvYywgYXJyYXlCdWZmZXIpOyByZXR1cm4gdHJ1ZTtcblx0XHRcdGNhc2UgNDogZ2wudW5pZm9ybTRpdihsb2MsIGFycmF5QnVmZmVyKTsgcmV0dXJuIHRydWU7XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHR0aHJvdyBcImludmFsaWQgYXJndW1lbnRzIHRvIHNldFVuaWZvcm1mXCI7IFxuXHRcdH1cblx0fSxcblxuXHQvKipcblx0ICogVGhpcyBpcyBhIGNvbnZlbmllbmNlIGZ1bmN0aW9uIHRvIHBhc3MgYSBNYXRyaXgzIChmcm9tIHZlY21hdGgsXG5cdCAqIGthbWkncyBwcmVmZXJyZWQgbWF0aCBsaWJyYXJ5KSBvciBhIEZsb2F0MzJBcnJheSAoZS5nLiBnbC1tYXRyaXgpXG5cdCAqIHRvIGEgc2hhZGVyLiBJZiBtYXQgaXMgYW4gb2JqZWN0IHdpdGggXCJ2YWxcIiwgaXQgaXMgY29uc2lkZXJlZCB0byBiZVxuXHQgKiBhIE1hdHJpeDMsIG90aGVyd2lzZSBhc3N1bWVkIHRvIGJlIGEgdHlwZWQgYXJyYXkgYmVpbmcgcGFzc2VkIGRpcmVjdGx5XG5cdCAqIHRvIHRoZSBzaGFkZXIuXG5cdCAqIFxuXHQgKiBAcGFyYW0ge1N0cmluZ30gbmFtZSB0aGUgdW5pZm9ybSBuYW1lXG5cdCAqIEBwYXJhbSB7TWF0cml4M3xGbG9hdDMyQXJyYXl9IG1hdCBhIE1hdHJpeDMgb3IgRmxvYXQzMkFycmF5XG5cdCAqIEBwYXJhbSB7Qm9vbGVhbn0gdHJhbnNwb3NlIHdoZXRoZXIgdG8gdHJhbnNwb3NlIHRoZSBtYXRyaXgsIGRlZmF1bHQgZmFsc2Vcblx0ICovXG5cdHNldFVuaWZvcm1NYXRyaXgzOiBmdW5jdGlvbihuYW1lLCBtYXQsIHRyYW5zcG9zZSkge1xuXHRcdCd1c2Ugc3RyaWN0Jztcblx0XHR2YXIgYXJyID0gdHlwZW9mIG1hdCA9PT0gXCJvYmplY3RcIiAmJiBtYXQudmFsID8gbWF0LnZhbCA6IG1hdDtcblx0XHR0cmFuc3Bvc2UgPSAhIXRyYW5zcG9zZTsgLy90byBib29sZWFuXG5cblx0XHR2YXIgZ2wgPSB0aGlzLmdsO1xuXHRcdHZhciBsb2MgPSB0aGlzLmdldFVuaWZvcm1Mb2NhdGlvbihuYW1lKTtcblx0XHRpZiAobG9jID09PSBudWxsKVxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdGdsLnVuaWZvcm1NYXRyaXgzZnYobG9jLCB0cmFuc3Bvc2UsIGFycilcblx0fSxcblxuXHQvKipcblx0ICogVGhpcyBpcyBhIGNvbnZlbmllbmNlIGZ1bmN0aW9uIHRvIHBhc3MgYSBNYXRyaXg0IChmcm9tIHZlY21hdGgsXG5cdCAqIGthbWkncyBwcmVmZXJyZWQgbWF0aCBsaWJyYXJ5KSBvciBhIEZsb2F0MzJBcnJheSAoZS5nLiBnbC1tYXRyaXgpXG5cdCAqIHRvIGEgc2hhZGVyLiBJZiBtYXQgaXMgYW4gb2JqZWN0IHdpdGggXCJ2YWxcIiwgaXQgaXMgY29uc2lkZXJlZCB0byBiZVxuXHQgKiBhIE1hdHJpeDQsIG90aGVyd2lzZSBhc3N1bWVkIHRvIGJlIGEgdHlwZWQgYXJyYXkgYmVpbmcgcGFzc2VkIGRpcmVjdGx5XG5cdCAqIHRvIHRoZSBzaGFkZXIuXG5cdCAqIFxuXHQgKiBAcGFyYW0ge1N0cmluZ30gbmFtZSB0aGUgdW5pZm9ybSBuYW1lXG5cdCAqIEBwYXJhbSB7TWF0cml4NHxGbG9hdDMyQXJyYXl9IG1hdCBhIE1hdHJpeDQgb3IgRmxvYXQzMkFycmF5XG5cdCAqIEBwYXJhbSB7Qm9vbGVhbn0gdHJhbnNwb3NlIHdoZXRoZXIgdG8gdHJhbnNwb3NlIHRoZSBtYXRyaXgsIGRlZmF1bHQgZmFsc2Vcblx0ICovXG5cdHNldFVuaWZvcm1NYXRyaXg0OiBmdW5jdGlvbihuYW1lLCBtYXQsIHRyYW5zcG9zZSkge1xuXHRcdCd1c2Ugc3RyaWN0Jztcblx0XHR2YXIgYXJyID0gdHlwZW9mIG1hdCA9PT0gXCJvYmplY3RcIiAmJiBtYXQudmFsID8gbWF0LnZhbCA6IG1hdDtcblx0XHR0cmFuc3Bvc2UgPSAhIXRyYW5zcG9zZTsgLy90byBib29sZWFuXG5cblx0XHR2YXIgZ2wgPSB0aGlzLmdsO1xuXHRcdHZhciBsb2MgPSB0aGlzLmdldFVuaWZvcm1Mb2NhdGlvbihuYW1lKTtcblx0XHRpZiAobG9jID09PSBudWxsKVxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdGdsLnVuaWZvcm1NYXRyaXg0ZnYobG9jLCB0cmFuc3Bvc2UsIGFycilcblx0fSBcbiBcbn0pO1xuXG4vL1NvbWUgZGVmYXVsdCBhdHRyaWJ1dGUgbmFtZXMgdGhhdCBwYXJ0cyBvZiBrYW1pIHdpbGwgdXNlXG4vL3doZW4gY3JlYXRpbmcgYSBzdGFuZGFyZCBzaGFkZXIuXG5TaGFkZXJQcm9ncmFtLlBPU0lUSU9OX0FUVFJJQlVURSA9IFwiUG9zaXRpb25cIjtcblNoYWRlclByb2dyYW0uTk9STUFMX0FUVFJJQlVURSA9IFwiTm9ybWFsXCI7XG5TaGFkZXJQcm9ncmFtLkNPTE9SX0FUVFJJQlVURSA9IFwiQ29sb3JcIjtcblNoYWRlclByb2dyYW0uVEVYQ09PUkRfQVRUUklCVVRFID0gXCJUZXhDb29yZFwiO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFNoYWRlclByb2dyYW07IiwiLyoqXG4gIEF1dG8tZ2VuZXJhdGVkIEthbWkgaW5kZXggZmlsZS5cbiAgQ3JlYXRlZCBvbiAyMDE0LTA2LTExLlxuKi9cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIC8vY29yZSBjbGFzc2VzXG4gICAgJ0Jhc2VCYXRjaCc6ICAgICAgIHJlcXVpcmUoJy4vQmFzZUJhdGNoLmpzJyksXG4gICAgJ1Nwcml0ZUJhdGNoJzogICAgIHJlcXVpcmUoJy4vU3ByaXRlQmF0Y2guanMnKSxcbiAgICAnVGV4dHVyZSc6ICAgICAgICAgcmVxdWlyZSgnLi9UZXh0dXJlLmpzJyksXG4gICAgJ1RleHR1cmVSZWdpb24nOiAgIHJlcXVpcmUoJy4vVGV4dHVyZVJlZ2lvbi5qcycpLFxuICAgICdXZWJHTENvbnRleHQnOiAgICByZXF1aXJlKCcuL1dlYkdMQ29udGV4dC5qcycpLFxuICAgICdGcmFtZUJ1ZmZlcic6ICAgICByZXF1aXJlKCcuL2dsdXRpbHMvRnJhbWVCdWZmZXIuanMnKSxcbiAgICAnTWVzaCc6ICAgICAgICAgICAgcmVxdWlyZSgnLi9nbHV0aWxzL01lc2guanMnKSxcbiAgICAnU2hhZGVyUHJvZ3JhbSc6ICAgcmVxdWlyZSgnLi9nbHV0aWxzL1NoYWRlclByb2dyYW0uanMnKVxufTsiLCJ2YXIgaW50OCA9IG5ldyBJbnQ4QXJyYXkoNCk7XG52YXIgaW50MzIgPSBuZXcgSW50MzJBcnJheShpbnQ4LmJ1ZmZlciwgMCwgMSk7XG52YXIgZmxvYXQzMiA9IG5ldyBGbG9hdDMyQXJyYXkoaW50OC5idWZmZXIsIDAsIDEpO1xuXG4vKipcbiAqIEEgc2luZ2xldG9uIGZvciBudW1iZXIgdXRpbGl0aWVzLiBcbiAqIEBjbGFzcyBOdW1iZXJVdGlsXG4gKi9cbnZhciBOdW1iZXJVdGlsID0gZnVuY3Rpb24oKSB7XG5cbn07XG5cblxuLyoqXG4gKiBSZXR1cm5zIGEgZmxvYXQgcmVwcmVzZW50YXRpb24gb2YgdGhlIGdpdmVuIGludCBiaXRzLiBBcnJheUJ1ZmZlclxuICogaXMgdXNlZCBmb3IgdGhlIGNvbnZlcnNpb24uXG4gKlxuICogQG1ldGhvZCAgaW50Qml0c1RvRmxvYXRcbiAqIEBzdGF0aWNcbiAqIEBwYXJhbSAge051bWJlcn0gaSB0aGUgaW50IHRvIGNhc3RcbiAqIEByZXR1cm4ge051bWJlcn0gICB0aGUgZmxvYXRcbiAqL1xuTnVtYmVyVXRpbC5pbnRCaXRzVG9GbG9hdCA9IGZ1bmN0aW9uKGkpIHtcblx0aW50MzJbMF0gPSBpO1xuXHRyZXR1cm4gZmxvYXQzMlswXTtcbn07XG5cbi8qKlxuICogUmV0dXJucyB0aGUgaW50IGJpdHMgZnJvbSB0aGUgZ2l2ZW4gZmxvYXQuIEFycmF5QnVmZmVyIGlzIHVzZWRcbiAqIGZvciB0aGUgY29udmVyc2lvbi5cbiAqXG4gKiBAbWV0aG9kICBmbG9hdFRvSW50Qml0c1xuICogQHN0YXRpY1xuICogQHBhcmFtICB7TnVtYmVyfSBmIHRoZSBmbG9hdCB0byBjYXN0XG4gKiBAcmV0dXJuIHtOdW1iZXJ9ICAgdGhlIGludCBiaXRzXG4gKi9cbk51bWJlclV0aWwuZmxvYXRUb0ludEJpdHMgPSBmdW5jdGlvbihmKSB7XG5cdGZsb2F0MzJbMF0gPSBmO1xuXHRyZXR1cm4gaW50MzJbMF07XG59O1xuXG4vKipcbiAqIEVuY29kZXMgQUJHUiBpbnQgYXMgYSBmbG9hdCwgd2l0aCBzbGlnaHQgcHJlY2lzaW9uIGxvc3MuXG4gKlxuICogQG1ldGhvZCAgaW50VG9GbG9hdENvbG9yXG4gKiBAc3RhdGljXG4gKiBAcGFyYW0ge051bWJlcn0gdmFsdWUgYW4gQUJHUiBwYWNrZWQgaW50ZWdlclxuICovXG5OdW1iZXJVdGlsLmludFRvRmxvYXRDb2xvciA9IGZ1bmN0aW9uKHZhbHVlKSB7XG5cdHJldHVybiBOdW1iZXJVdGlsLmludEJpdHNUb0Zsb2F0KCB2YWx1ZSAmIDB4ZmVmZmZmZmYgKTtcbn07XG5cbi8qKlxuICogUmV0dXJucyBhIGZsb2F0IGVuY29kZWQgQUJHUiB2YWx1ZSBmcm9tIHRoZSBnaXZlbiBSR0JBXG4gKiBieXRlcyAoMCAtIDI1NSkuIFVzZWZ1bCBmb3Igc2F2aW5nIGJhbmR3aWR0aCBpbiB2ZXJ0ZXggZGF0YS5cbiAqXG4gKiBAbWV0aG9kICBjb2xvclRvRmxvYXRcbiAqIEBzdGF0aWNcbiAqIEBwYXJhbSB7TnVtYmVyfSByIHRoZSBSZWQgYnl0ZSAoMCAtIDI1NSlcbiAqIEBwYXJhbSB7TnVtYmVyfSBnIHRoZSBHcmVlbiBieXRlICgwIC0gMjU1KVxuICogQHBhcmFtIHtOdW1iZXJ9IGIgdGhlIEJsdWUgYnl0ZSAoMCAtIDI1NSlcbiAqIEBwYXJhbSB7TnVtYmVyfSBhIHRoZSBBbHBoYSBieXRlICgwIC0gMjU1KVxuICogQHJldHVybiB7RmxvYXQzMn0gIGEgRmxvYXQzMiBvZiB0aGUgUkdCQSBjb2xvclxuICovXG5OdW1iZXJVdGlsLmNvbG9yVG9GbG9hdCA9IGZ1bmN0aW9uKHIsIGcsIGIsIGEpIHtcblx0dmFyIGJpdHMgPSAoYSA8PCAyNCB8IGIgPDwgMTYgfCBnIDw8IDggfCByKTtcblx0cmV0dXJuIE51bWJlclV0aWwuaW50VG9GbG9hdENvbG9yKGJpdHMpO1xufTtcblxuLyoqXG4gKiBSZXR1cm5zIHRydWUgaWYgdGhlIG51bWJlciBpcyBhIHBvd2VyLW9mLXR3by5cbiAqXG4gKiBAbWV0aG9kICBpc1Bvd2VyT2ZUd29cbiAqIEBwYXJhbSAge051bWJlcn0gIG4gdGhlIG51bWJlciB0byB0ZXN0XG4gKiBAcmV0dXJuIHtCb29sZWFufSAgIHRydWUgaWYgcG93ZXItb2YtdHdvXG4gKi9cbk51bWJlclV0aWwuaXNQb3dlck9mVHdvID0gZnVuY3Rpb24obikge1xuXHRyZXR1cm4gKG4gJiAobiAtIDEpKSA9PT0gMDtcbn07XG5cbi8qKlxuICogUmV0dXJucyB0aGUgbmV4dCBoaWdoZXN0IHBvd2VyLW9mLXR3byBmcm9tIHRoZSBzcGVjaWZpZWQgbnVtYmVyLiBcbiAqIFxuICogQHBhcmFtICB7TnVtYmVyfSBuIHRoZSBudW1iZXIgdG8gdGVzdFxuICogQHJldHVybiB7TnVtYmVyfSAgIHRoZSBuZXh0IGhpZ2hlc3QgcG93ZXIgb2YgdHdvXG4gKi9cbk51bWJlclV0aWwubmV4dFBvd2VyT2ZUd28gPSBmdW5jdGlvbihuKSB7XG5cdG4tLTtcblx0biB8PSBuID4+IDE7XG5cdG4gfD0gbiA+PiAyO1xuXHRuIHw9IG4gPj4gNDtcblx0biB8PSBuID4+IDg7XG5cdG4gfD0gbiA+PiAxNjtcblx0cmV0dXJuIG4rMTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gTnVtYmVyVXRpbDsiLCJmdW5jdGlvbiBoYXNHZXR0ZXJPclNldHRlcihkZWYpIHtcblx0cmV0dXJuICghIWRlZi5nZXQgJiYgdHlwZW9mIGRlZi5nZXQgPT09IFwiZnVuY3Rpb25cIikgfHwgKCEhZGVmLnNldCAmJiB0eXBlb2YgZGVmLnNldCA9PT0gXCJmdW5jdGlvblwiKTtcbn1cblxuZnVuY3Rpb24gZ2V0UHJvcGVydHkoZGVmaW5pdGlvbiwgaywgaXNDbGFzc0Rlc2NyaXB0b3IpIHtcblx0Ly9UaGlzIG1heSBiZSBhIGxpZ2h0d2VpZ2h0IG9iamVjdCwgT1IgaXQgbWlnaHQgYmUgYSBwcm9wZXJ0eVxuXHQvL3RoYXQgd2FzIGRlZmluZWQgcHJldmlvdXNseS5cblx0XG5cdC8vRm9yIHNpbXBsZSBjbGFzcyBkZXNjcmlwdG9ycyB3ZSBjYW4ganVzdCBhc3N1bWUgaXRzIE5PVCBwcmV2aW91c2x5IGRlZmluZWQuXG5cdHZhciBkZWYgPSBpc0NsYXNzRGVzY3JpcHRvciBcblx0XHRcdFx0PyBkZWZpbml0aW9uW2tdIFxuXHRcdFx0XHQ6IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IoZGVmaW5pdGlvbiwgayk7XG5cblx0aWYgKCFpc0NsYXNzRGVzY3JpcHRvciAmJiBkZWYudmFsdWUgJiYgdHlwZW9mIGRlZi52YWx1ZSA9PT0gXCJvYmplY3RcIikge1xuXHRcdGRlZiA9IGRlZi52YWx1ZTtcblx0fVxuXG5cblx0Ly9UaGlzIG1pZ2h0IGJlIGEgcmVndWxhciBwcm9wZXJ0eSwgb3IgaXQgbWF5IGJlIGEgZ2V0dGVyL3NldHRlciB0aGUgdXNlciBkZWZpbmVkIGluIGEgY2xhc3MuXG5cdGlmICggZGVmICYmIGhhc0dldHRlck9yU2V0dGVyKGRlZikgKSB7XG5cdFx0aWYgKHR5cGVvZiBkZWYuZW51bWVyYWJsZSA9PT0gXCJ1bmRlZmluZWRcIilcblx0XHRcdGRlZi5lbnVtZXJhYmxlID0gdHJ1ZTtcblx0XHRpZiAodHlwZW9mIGRlZi5jb25maWd1cmFibGUgPT09IFwidW5kZWZpbmVkXCIpXG5cdFx0XHRkZWYuY29uZmlndXJhYmxlID0gdHJ1ZTtcblx0XHRyZXR1cm4gZGVmO1xuXHR9IGVsc2Uge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxufVxuXG5mdW5jdGlvbiBoYXNOb25Db25maWd1cmFibGUob2JqLCBrKSB7XG5cdHZhciBwcm9wID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihvYmosIGspO1xuXHRpZiAoIXByb3ApXG5cdFx0cmV0dXJuIGZhbHNlO1xuXG5cdGlmIChwcm9wLnZhbHVlICYmIHR5cGVvZiBwcm9wLnZhbHVlID09PSBcIm9iamVjdFwiKVxuXHRcdHByb3AgPSBwcm9wLnZhbHVlO1xuXG5cdGlmIChwcm9wLmNvbmZpZ3VyYWJsZSA9PT0gZmFsc2UpIFxuXHRcdHJldHVybiB0cnVlO1xuXG5cdHJldHVybiBmYWxzZTtcbn1cblxuLy9UT0RPOiBPbiBjcmVhdGUsIFxuLy9cdFx0T24gbWl4aW4sIFxuXG5mdW5jdGlvbiBleHRlbmQoY3RvciwgZGVmaW5pdGlvbiwgaXNDbGFzc0Rlc2NyaXB0b3IsIGV4dGVuZCkge1xuXHRmb3IgKHZhciBrIGluIGRlZmluaXRpb24pIHtcblx0XHRpZiAoIWRlZmluaXRpb24uaGFzT3duUHJvcGVydHkoaykpXG5cdFx0XHRjb250aW51ZTtcblxuXHRcdHZhciBkZWYgPSBnZXRQcm9wZXJ0eShkZWZpbml0aW9uLCBrLCBpc0NsYXNzRGVzY3JpcHRvcik7XG5cblx0XHRpZiAoZGVmICE9PSBmYWxzZSkge1xuXHRcdFx0Ly9JZiBFeHRlbmRzIGlzIHVzZWQsIHdlIHdpbGwgY2hlY2sgaXRzIHByb3RvdHlwZSB0byBzZWUgaWYgXG5cdFx0XHQvL3RoZSBmaW5hbCB2YXJpYWJsZSBleGlzdHMuXG5cdFx0XHRcblx0XHRcdHZhciBwYXJlbnQgPSBleHRlbmQgfHwgY3Rvcjtcblx0XHRcdGlmIChoYXNOb25Db25maWd1cmFibGUocGFyZW50LnByb3RvdHlwZSwgaykpIHtcblxuXHRcdFx0XHQvL2p1c3Qgc2tpcCB0aGUgZmluYWwgcHJvcGVydHlcblx0XHRcdFx0aWYgKENsYXNzLmlnbm9yZUZpbmFscylcblx0XHRcdFx0XHRjb250aW51ZTtcblxuXHRcdFx0XHQvL1dlIGNhbm5vdCByZS1kZWZpbmUgYSBwcm9wZXJ0eSB0aGF0IGlzIGNvbmZpZ3VyYWJsZT1mYWxzZS5cblx0XHRcdFx0Ly9TbyB3ZSB3aWxsIGNvbnNpZGVyIHRoZW0gZmluYWwgYW5kIHRocm93IGFuIGVycm9yLiBUaGlzIGlzIGJ5XG5cdFx0XHRcdC8vZGVmYXVsdCBzbyBpdCBpcyBjbGVhciB0byB0aGUgZGV2ZWxvcGVyIHdoYXQgaXMgaGFwcGVuaW5nLlxuXHRcdFx0XHQvL1lvdSBjYW4gc2V0IGlnbm9yZUZpbmFscyB0byB0cnVlIGlmIHlvdSBuZWVkIHRvIGV4dGVuZCBhIGNsYXNzXG5cdFx0XHRcdC8vd2hpY2ggaGFzIGNvbmZpZ3VyYWJsZT1mYWxzZTsgaXQgd2lsbCBzaW1wbHkgbm90IHJlLWRlZmluZSBmaW5hbCBwcm9wZXJ0aWVzLlxuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJjYW5ub3Qgb3ZlcnJpZGUgZmluYWwgcHJvcGVydHkgJ1wiK2tcblx0XHRcdFx0XHRcdFx0K1wiJywgc2V0IENsYXNzLmlnbm9yZUZpbmFscyA9IHRydWUgdG8gc2tpcFwiKTtcblx0XHRcdH1cblxuXHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGN0b3IucHJvdG90eXBlLCBrLCBkZWYpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjdG9yLnByb3RvdHlwZVtrXSA9IGRlZmluaXRpb25ba107XG5cdFx0fVxuXG5cdH1cbn1cblxuLyoqXG4gKi9cbmZ1bmN0aW9uIG1peGluKG15Q2xhc3MsIG1peGlucykge1xuXHRpZiAoIW1peGlucylcblx0XHRyZXR1cm47XG5cblx0aWYgKCFBcnJheS5pc0FycmF5KG1peGlucykpXG5cdFx0bWl4aW5zID0gW21peGluc107XG5cblx0Zm9yICh2YXIgaT0wOyBpPG1peGlucy5sZW5ndGg7IGkrKykge1xuXHRcdGV4dGVuZChteUNsYXNzLCBtaXhpbnNbaV0ucHJvdG90eXBlIHx8IG1peGluc1tpXSk7XG5cdH1cbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgbmV3IGNsYXNzIHdpdGggdGhlIGdpdmVuIGRlc2NyaXB0b3IuXG4gKiBUaGUgY29uc3RydWN0b3IsIGRlZmluZWQgYnkgdGhlIG5hbWUgYGluaXRpYWxpemVgLFxuICogaXMgYW4gb3B0aW9uYWwgZnVuY3Rpb24uIElmIHVuc3BlY2lmaWVkLCBhbiBhbm9ueW1vdXNcbiAqIGZ1bmN0aW9uIHdpbGwgYmUgdXNlZCB3aGljaCBjYWxscyB0aGUgcGFyZW50IGNsYXNzIChpZlxuICogb25lIGV4aXN0cykuIFxuICpcbiAqIFlvdSBjYW4gYWxzbyB1c2UgYEV4dGVuZHNgIGFuZCBgTWl4aW5zYCB0byBwcm92aWRlIHN1YmNsYXNzaW5nXG4gKiBhbmQgaW5oZXJpdGFuY2UuXG4gKlxuICogQGNsYXNzICBDbGFzc1xuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0ge09iamVjdH0gZGVmaW5pdGlvbiBhIGRpY3Rpb25hcnkgb2YgZnVuY3Rpb25zIGZvciB0aGUgY2xhc3NcbiAqIEBleGFtcGxlXG4gKlxuICogXHRcdHZhciBNeUNsYXNzID0gbmV3IENsYXNzKHtcbiAqIFx0XHRcbiAqIFx0XHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uKCkge1xuICogXHRcdFx0XHR0aGlzLmZvbyA9IDIuMDtcbiAqIFx0XHRcdH0sXG4gKlxuICogXHRcdFx0YmFyOiBmdW5jdGlvbigpIHtcbiAqIFx0XHRcdFx0cmV0dXJuIHRoaXMuZm9vICsgNTtcbiAqIFx0XHRcdH1cbiAqIFx0XHR9KTtcbiAqL1xuZnVuY3Rpb24gQ2xhc3MoZGVmaW5pdGlvbikge1xuXHRpZiAoIWRlZmluaXRpb24pXG5cdFx0ZGVmaW5pdGlvbiA9IHt9O1xuXG5cdC8vVGhlIHZhcmlhYmxlIG5hbWUgaGVyZSBkaWN0YXRlcyB3aGF0IHdlIHNlZSBpbiBDaHJvbWUgZGVidWdnZXJcblx0dmFyIGluaXRpYWxpemU7XG5cdHZhciBFeHRlbmRzO1xuXG5cdGlmIChkZWZpbml0aW9uLmluaXRpYWxpemUpIHtcblx0XHRpZiAodHlwZW9mIGRlZmluaXRpb24uaW5pdGlhbGl6ZSAhPT0gXCJmdW5jdGlvblwiKVxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiaW5pdGlhbGl6ZSBtdXN0IGJlIGEgZnVuY3Rpb25cIik7XG5cdFx0aW5pdGlhbGl6ZSA9IGRlZmluaXRpb24uaW5pdGlhbGl6ZTtcblxuXHRcdC8vVXN1YWxseSB3ZSBzaG91bGQgYXZvaWQgXCJkZWxldGVcIiBpbiBWOCBhdCBhbGwgY29zdHMuXG5cdFx0Ly9Ib3dldmVyLCBpdHMgdW5saWtlbHkgdG8gbWFrZSBhbnkgcGVyZm9ybWFuY2UgZGlmZmVyZW5jZVxuXHRcdC8vaGVyZSBzaW5jZSB3ZSBvbmx5IGNhbGwgdGhpcyBvbiBjbGFzcyBjcmVhdGlvbiAoaS5lLiBub3Qgb2JqZWN0IGNyZWF0aW9uKS5cblx0XHRkZWxldGUgZGVmaW5pdGlvbi5pbml0aWFsaXplO1xuXHR9IGVsc2Uge1xuXHRcdGlmIChkZWZpbml0aW9uLkV4dGVuZHMpIHtcblx0XHRcdHZhciBiYXNlID0gZGVmaW5pdGlvbi5FeHRlbmRzO1xuXHRcdFx0aW5pdGlhbGl6ZSA9IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0YmFzZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuXHRcdFx0fTsgXG5cdFx0fSBlbHNlIHtcblx0XHRcdGluaXRpYWxpemUgPSBmdW5jdGlvbiAoKSB7fTsgXG5cdFx0fVxuXHR9XG5cblx0aWYgKGRlZmluaXRpb24uRXh0ZW5kcykge1xuXHRcdGluaXRpYWxpemUucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShkZWZpbml0aW9uLkV4dGVuZHMucHJvdG90eXBlKTtcblx0XHRpbml0aWFsaXplLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IGluaXRpYWxpemU7XG5cdFx0Ly9mb3IgZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yIHRvIHdvcmssIHdlIG5lZWQgdG8gYWN0XG5cdFx0Ly9kaXJlY3RseSBvbiB0aGUgRXh0ZW5kcyAob3IgTWl4aW4pXG5cdFx0RXh0ZW5kcyA9IGRlZmluaXRpb24uRXh0ZW5kcztcblx0XHRkZWxldGUgZGVmaW5pdGlvbi5FeHRlbmRzO1xuXHR9IGVsc2Uge1xuXHRcdGluaXRpYWxpemUucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gaW5pdGlhbGl6ZTtcblx0fVxuXG5cdC8vR3JhYiB0aGUgbWl4aW5zLCBpZiB0aGV5IGFyZSBzcGVjaWZpZWQuLi5cblx0dmFyIG1peGlucyA9IG51bGw7XG5cdGlmIChkZWZpbml0aW9uLk1peGlucykge1xuXHRcdG1peGlucyA9IGRlZmluaXRpb24uTWl4aW5zO1xuXHRcdGRlbGV0ZSBkZWZpbml0aW9uLk1peGlucztcblx0fVxuXG5cdC8vRmlyc3QsIG1peGluIGlmIHdlIGNhbi5cblx0bWl4aW4oaW5pdGlhbGl6ZSwgbWl4aW5zKTtcblxuXHQvL05vdyB3ZSBncmFiIHRoZSBhY3R1YWwgZGVmaW5pdGlvbiB3aGljaCBkZWZpbmVzIHRoZSBvdmVycmlkZXMuXG5cdGV4dGVuZChpbml0aWFsaXplLCBkZWZpbml0aW9uLCB0cnVlLCBFeHRlbmRzKTtcblxuXHRyZXR1cm4gaW5pdGlhbGl6ZTtcbn07XG5cbkNsYXNzLmV4dGVuZCA9IGV4dGVuZDtcbkNsYXNzLm1peGluID0gbWl4aW47XG5DbGFzcy5pZ25vcmVGaW5hbHMgPSBmYWxzZTtcblxubW9kdWxlLmV4cG9ydHMgPSBDbGFzczsiLCIvKlxuICogcmFmLmpzXG4gKiBodHRwczovL2dpdGh1Yi5jb20vbmdyeW1hbi9yYWYuanNcbiAqXG4gKiBvcmlnaW5hbCByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgcG9seWZpbGwgYnkgRXJpayBNw7ZsbGVyXG4gKiBpbnNwaXJlZCBmcm9tIHBhdWxfaXJpc2ggZ2lzdCBhbmQgcG9zdFxuICpcbiAqIENvcHlyaWdodCAoYykgMjAxMyBuZ3J5bWFuXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2UuXG4gKi9cblxuKGZ1bmN0aW9uKHdpbmRvdykge1xuXHR2YXIgbGFzdFRpbWUgPSAwLFxuXHRcdHZlbmRvcnMgPSBbJ3dlYmtpdCcsICdtb3onXSxcblx0XHRyZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lLFxuXHRcdGNhbmNlbEFuaW1hdGlvbkZyYW1lID0gd2luZG93LmNhbmNlbEFuaW1hdGlvbkZyYW1lLFxuXHRcdGkgPSB2ZW5kb3JzLmxlbmd0aDtcblxuXHQvLyB0cnkgdG8gdW4tcHJlZml4IGV4aXN0aW5nIHJhZlxuXHR3aGlsZSAoLS1pID49IDAgJiYgIXJlcXVlc3RBbmltYXRpb25GcmFtZSkge1xuXHRcdHJlcXVlc3RBbmltYXRpb25GcmFtZSA9IHdpbmRvd1t2ZW5kb3JzW2ldICsgJ1JlcXVlc3RBbmltYXRpb25GcmFtZSddO1xuXHRcdGNhbmNlbEFuaW1hdGlvbkZyYW1lID0gd2luZG93W3ZlbmRvcnNbaV0gKyAnQ2FuY2VsQW5pbWF0aW9uRnJhbWUnXTtcblx0fVxuXG5cdC8vIHBvbHlmaWxsIHdpdGggc2V0VGltZW91dCBmYWxsYmFja1xuXHQvLyBoZWF2aWx5IGluc3BpcmVkIGZyb20gQGRhcml1cyBnaXN0IG1vZDogaHR0cHM6Ly9naXN0LmdpdGh1Yi5jb20vcGF1bGlyaXNoLzE1Nzk2NzEjY29tbWVudC04Mzc5NDVcblx0aWYgKCFyZXF1ZXN0QW5pbWF0aW9uRnJhbWUgfHwgIWNhbmNlbEFuaW1hdGlvbkZyYW1lKSB7XG5cdFx0cmVxdWVzdEFuaW1hdGlvbkZyYW1lID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcblx0XHRcdHZhciBub3cgPSBEYXRlLm5vdygpLCBuZXh0VGltZSA9IE1hdGgubWF4KGxhc3RUaW1lICsgMTYsIG5vdyk7XG5cdFx0XHRyZXR1cm4gc2V0VGltZW91dChmdW5jdGlvbigpIHtcblx0XHRcdFx0Y2FsbGJhY2sobGFzdFRpbWUgPSBuZXh0VGltZSk7XG5cdFx0XHR9LCBuZXh0VGltZSAtIG5vdyk7XG5cdFx0fTtcblxuXHRcdGNhbmNlbEFuaW1hdGlvbkZyYW1lID0gY2xlYXJUaW1lb3V0O1xuXHR9XG5cblx0Ly8gZXhwb3J0IHRvIHdpbmRvd1xuXHR3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lO1xuXHR3aW5kb3cuY2FuY2VsQW5pbWF0aW9uRnJhbWUgPSBjYW5jZWxBbmltYXRpb25GcmFtZTtcbn0od2luZG93KSk7IiwidmFyIGRvbXJlYWR5ID0gcmVxdWlyZSgnZG9tcmVhZHknKTtcblxudmFyIFdlYkdMQ29udGV4dCA9IHJlcXVpcmUoJ2thbWknKS5XZWJHTENvbnRleHQ7XG52YXIgVGV4dHVyZSA9IHJlcXVpcmUoJ2thbWknKS5UZXh0dXJlO1xudmFyIFNwcml0ZUJhdGNoID0gcmVxdWlyZSgna2FtaScpLlNwcml0ZUJhdGNoO1xuXG4vL2luY2x1ZGUgdGhlIGthbWktc3BlY2lmaWMgQXNzZXRMb2FkZXJcbnZhciBBc3NldExvYWRlciA9IHJlcXVpcmUoJ2thbWktYXNzZXRzJyk7XG5cbi8vaW5jbHVkZSBwb2x5ZmlsbCBmb3IgcmVxdWVzdEFuaW1hdGlvbkZyYW1lXG5yZXF1aXJlKCdyYWYuanMnKTtcblxuZG9tcmVhZHkoZnVuY3Rpb24oKSB7XG4gICAgLy9DcmVhdGUgYSBuZXcgV2ViR0wgY2FudmFzIHdpdGggdGhlIGdpdmVuIHNpemVcbiAgICB2YXIgY29udGV4dCA9IG5ldyBXZWJHTENvbnRleHQoMjU2LCAyNTYpO1xuXG4gICAgLy90aGUgJ3ZpZXcnIGlzIHRoZSBET00gY2FudmFzLCBzbyB3ZSBjYW4ganVzdCBhcHBlbmQgaXQgdG8gb3VyIGJvZHlcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKCBjb250ZXh0LnZpZXcgKTtcblxuICAgIC8vV2UgdXNlIFNwcml0ZUJhdGNoIHRvIGRyYXcgdGV4dHVyZXMgYXMgMkQgcXVhZHNcbiAgICB2YXIgYmF0Y2ggPSBuZXcgU3ByaXRlQmF0Y2goY29udGV4dCk7XG4gICAgXG4gICAgLy9wYXNzIHRoZSBjb250ZXh0IHRvIHRoZSBhc3NldCBsb2FkZXIgc28gaXQgY2FuIGJlIG1hbmFnZWQgY29ycmVjdGx5IFxuICAgIHZhciBhc3NldHMgPSBuZXcgQXNzZXRMb2FkZXIoY29udGV4dCk7XG4gICAgXG4gICAgLy9hZGQgc29tZSBET00gdGV4dFxuICAgIHZhciB0ZXh0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRleHQpO1xuXG4gICAgLy9hZGQgc29tZSBsaXN0ZW5lcnMuLi5cbiAgICBhc3NldHMubG9hZFN0YXJ0ZWQuYWRkKGZ1bmN0aW9uKGV2KSB7XG4gICAgICAgIHRleHQuaW5uZXJIVE1MID0gXCJMb2FkIHN0YXJ0ZWRcIjtcbiAgICB9KTtcbiAgICBhc3NldHMubG9hZFByb2dyZXNzLmFkZChmdW5jdGlvbihldikge1xuICAgICAgICB0ZXh0LmlubmVySFRNTCA9IFwiUHJvZ3Jlc3M6IFwiK2V2LmN1cnJlbnQgKyBcIiAvIFwiICsgZXYudG90YWw7XG4gICAgfSk7XG4gICAgYXNzZXRzLmxvYWRGaW5pc2hlZC5hZGQoZnVuY3Rpb24oZXYpIHtcbiAgICAgICAgdGV4dC5pbm5lckhUTUwgPSBcIkxvYWQgZmluaXNoZWRcIjtcbiAgICB9KVxuXG4gICAgLy9UaGVzZSByZXR1cm4gYSBUZXh0dXJlIG9iamVjdFxuICAgIHZhciBzY2VuZSA9IGFzc2V0cy5hZGQoXCJpbWcvc2NlbmUucG5nXCIpO1xuICAgIHZhciBncmFzcyA9IGFzc2V0cy5hZGQoXCJpbWcvZ3Jhc3MucG5nXCIpO1xuICAgIHZhciBndXkgICA9IGFzc2V0cy5hZGQoXCJpbWcvZ3V5LnBuZ1wiKTtcbiAgICBncmFzcy5zZXRGaWx0ZXIoVGV4dHVyZS5GaWx0ZXIuTElORUFSKTtcbiAgICAvL21ha2UgdGhlIHF1ZXVlIGEgYml0IGxvbmdlci4uLlxuICAgIHZhciB0ZXggPSBuZXcgVGV4dHVyZShjb250ZXh0KTtcbiAgICBmb3IgKHZhciBpPTA7IGk8NTA7IGkrKykge1xuICAgICAgICAvL3dlIGNhbiBzcGVjaWZ5IGEga2V5LCBVUkwsIGFuZCByZXVzYWJsZSBUZXh0dXJlIG9iamVjdCB0byBhY3Qgb25cbiAgICAgICAgLy9XZSBzcGVjaWZ5IGEgZmlsZW5hbWUgc28gaXQgY2FuIGZpbmQgdGhlIGltYWdlIGxvYWRlciBlYXNpbHlcbiAgICAgICAgYXNzZXRzLmFkZChcImltZ1wiK2krXCIucG5nXCIsIFwiaW1nL2dyYXNzLnBuZ1wiLCB0ZXgpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHJlbmRlcigpIHtcbiAgICAgICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHJlbmRlcik7XG4gICAgICAgIC8vZ2V0IHRoZSBHTCByZW5kZXJpbmcgY29udGV4dFxuICAgICAgICB2YXIgZ2wgPSBjb250ZXh0LmdsO1xuXG4gICAgICAgIC8vY2xlYXIgY2FudmFzIHdpdGggb3BhcXVlIGJsYWNrXG4gICAgICAgIGdsLmNsZWFyQ29sb3IoMCwwLDAsMSk7XG4gICAgICAgIGdsLmNsZWFyKGdsLkNPTE9SX0JVRkZFUl9CSVQpOyAgICAgICAgICAgIFxuXG4gICAgICAgIC8vdGhpcyB3aWxsIHN0YXJ0IGxvYWRpbmcgdGhlIG5leHQgdGFzayBvbiB0aGUgcXVldWUsXG4gICAgICAgIC8vYW5kIG9ubHkgcmV0dXJucyB0cnVlIG9uY2UgYWxsIGFzc2V0cyBoYXZlIGZpbmlzaGVkIGxvYWRpbmdcbiAgICAgICAgaWYgKCBhc3NldHMudXBkYXRlKCkgKSB7XG4gICAgICAgICAgICBiYXRjaC5iZWdpbigpO1xuICAgICAgICAgICAgYmF0Y2guZHJhdyhncmFzcywgMCwgMCk7XG4gICAgICAgICAgICBiYXRjaC5kcmF3KGd1eSwgMjUsIDI1LCBndXkud2lkdGgqMiwgZ3V5LmhlaWdodCoyKTtcbiAgICAgICAgICAgIGJhdGNoLmVuZCgpO1xuICAgICAgICB9IFxuICAgIH1cblxuICAgIC8vSGVyZSB3ZSBjYW4gc2ltdWxhdGUgY29udGV4dCBsb3NzIC8gcmVzdG9yZSBhbmQgaG93IGl0IHBsYXlzIHdpdGggQXNzZXRMb2FkZXJcbiAgICB2YXIgbG9zZUN0eCA9IGNvbnRleHQuZ2wuZ2V0RXh0ZW5zaW9uKFwiV0VCR0xfbG9zZV9jb250ZXh0XCIpO1xuICAgIGlmIChsb3NlQ3R4KSB7XG4gICAgICAgIHZhciBkZXNjID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICAgICAgZGVzYy5pbm5lckhUTUwgPSBcIkNsaWNrIHRoZSBjYW52YXMgdG8gc2ltdWxhdGUgY29udGV4dCBsb3NzXCI7XG4gICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZGVzYyk7XG5cbiAgICAgICAgY29udGV4dC52aWV3LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZWRvd25cIiwgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBsb3NlQ3R4Lmxvc2VDb250ZXh0KCk7XG4gICAgICAgICAgICBjb250ZXh0LnZpZXcuc3R5bGUudmlzaWJpbGl0eSA9IFwiaGlkZGVuXCI7XG4gICAgICAgICAgICB0ZXh0LnN0eWxlLnZpc2liaWxpdHkgPSBcImhpZGRlblwiO1xuXG4gICAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIGNvbnRleHQudmlldy5zdHlsZS52aXNpYmlsaXR5ID0gXCJ2aXNpYmxlXCI7XG4gICAgICAgICAgICAgICAgdGV4dC5zdHlsZS52aXNpYmlsaXR5ID0gXCJ2aXNpYmxlXCI7XG4gICAgICAgICAgICAgICAgbG9zZUN0eC5yZXN0b3JlQ29udGV4dCgpO1xuICAgICAgICAgICAgfSwgMTAwMCk7XG4gICAgICAgIH0sIHRydWUpO1xuICAgIH1cblxuICAgIHJlcXVlc3RBbmltYXRpb25GcmFtZShyZW5kZXIpO1xufSk7Il19
