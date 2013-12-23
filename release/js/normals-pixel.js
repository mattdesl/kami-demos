(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

},{}],2:[function(require,module,exports){
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

},{}],3:[function(require,module,exports){
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

        load: function(finished) {
            var img = new Image(); 

            img.onload = function() {
                img.onerror = img.onabort = null; //clear other listeners
                texture.uploadImage(img, undefined, undefined, genMipmaps);
                finished();
            };
            img.onerror = function() {
                img.onload = img.onabort = null;
                console.warn("Error loading image: "+path);
                //We use null data to avoid WebGL errors
                texture.uploadData(1, 1, undefined, undefined, undefined, genMipmaps); 
                finished(false);
            };
            img.onabort = function() {
                img.onload = img.onerror = null;
                console.warn("Aborted image: "+path);
                //We use null data to avoid WebGL errors
                texture.uploadData(1, 1, undefined, undefined, undefined, genMipmaps); 
                finished(false);
            };
            //setup source
            img.src = path;
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

        if (!context)
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
},{"assetloader":4,"kami":15,"klasse":6}],4:[function(require,module,exports){
var Class = require('klasse');
var Signal = require('signals');

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
	 * @attribute remaining
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
	 * @attribute total
	 * @readOnly
	 * @type {Number}
	 */
	total: {
		get: function() {
			return this.__totalItems;
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

		var cb = this.__loadCallback.bind(this, nextTask.name);

		//do the async load ...
		loader.call(this, cb);

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

},{"klasse":6,"signals":5}],5:[function(require,module,exports){
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
 * 
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
},{}],7:[function(require,module,exports){
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
				
		
		//TODO: make these public
		this._blendSrc = this.context.gl.ONE;
		this._blendDst = this.context.gl.ONE_MINUS_SRC_ALPHA
		this._blendEnabled = true;
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
	 * If three or more arguments are specified, this method assumes that RGB 
	 * or RGBA float values (0.0 to 1.0) are being passed. 
	 * 
	 * If less than three arguments are specified, we only consider the first 
	 * and assign it to all four components -- this is useful for setting transparency 
	 * in a premultiplied alpha stage.
	 *
	 * @method  setColor
	 * @param {Number} r the red component, normalized
	 * @param {Number} g the green component, normalized
	 * @param {Number} b the blue component, normalized
	 * @param {Number} a the alpha component, normalized
	 */
	setColor: function(r, g, b, a) {
		if (arguments.length >= 3) {
			//default alpha to one 
			a = (a || a === 0) ? a : 1.0;
		} else {
			r = g = b = a = (arguments[0] || 0);
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
	 * Called after flushing the batch. This method
	 * does nothing by default.
	 *
	 * @method  _postRender
	 */
	_postRender: function() {
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

		var gl = this.gl;
		
		this._preRender();

		//number of sprites in batch
		var numComponents = this.getVertexSize();
		var spriteCount = (this.idx / (numComponents * 4));
		
		//draw the sprites
		var gl = this.context.gl;
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
		this.vertices = [];
		this.indices = [];
		this.size = this.maxVertices = 0;

		if (this.defaultShader)
			this.defaultShader.destroy();
		this.defaultShader = null;
		this._shader = null; // remove reference to whatever shader is currently being used

		if (this.mesh) 
			this.mesh.destroy();
		this.mesh = null;
	}
});

module.exports = BaseBatch;

},{"./glutils/Mesh":13,"klasse":16,"number-util":17}],8:[function(require,module,exports){
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
			new Mesh.Attrib("Position", 2),
			 //pack the color using some crazy wizardry 
			new Mesh.Attrib("Color", 4, null, gl.UNSIGNED_BYTE, true, 1),
			new Mesh.Attrib("TexCoord0", 2)
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

		//premultiplied alpha
		if (this._blendEnabled) {
			gl.enable(gl.BLEND);

			//set either to -1 if you want to call your own 
			//blendFunc or blendFuncSeparate
			if (this._blendSrc !== -1 && this._blendDst !== -1)
				gl.blendFunc(this._blendSrc, this._blendDst); 
		}
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

		if (this._blendEnabled)
			gl.disable(gl.BLEND);
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
	"attribute vec2 Position;",
	"attribute vec4 Color;",
	"attribute vec2 TexCoord0;",

	"uniform vec2 u_projection;",
	"varying vec2 vTexCoord0;",
	"varying vec4 vColor;",

	"void main(void) {",
	"   gl_Position = vec4( Position.x / u_projection.x - 1.0, Position.y / -u_projection.y + 1.0 , 0.0, 1.0);",
	"   vTexCoord0 = TexCoord0;",
	"   vColor = Color;",
	"}"
].join('\n');

module.exports = SpriteBatch;

},{"./BaseBatch":7,"./glutils/Mesh":13,"./glutils/ShaderProgram":14,"klasse":16}],9:[function(require,module,exports){
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
	 * _Note:_ To avoid WebGL errors with the Image URL constructor,
	 * we upload a dummy 1x1 transparent texture until the async Image load has been completed. So
	 * the width and height will not be accurate until the onComplete callback is fired.
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
	 * 		new Texture("test.png"); //loads image asynchronously
	 * 		new Texture("test.png", successFunc, failFunc, useMipmaps); //extra params for image laoder 
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
		this.target = null; //initialized in create()

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

		this.wrapS = Texture.DEFAULT_WRAP;
		this.wrapT = Texture.DEFAULT_WRAP;
		this.minFilter = Texture.DEFAULT_FILTER;
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
		 * @type {Array} the array of arguments, shifted to exclude the WebGLContext parameter
		 */
		this.managedArgs = Array.prototype.slice.call(arguments, 1);

		//This is maanged by WebGLContext
		this.context.addManagedObject(this);
		this.create();
	},

	/**
	 * On instantiation and subsequent context restore, this function is called
	 * to parse the constructor's arguments.
	 * 
	 * @protected
	 */
	_handleCreate: function(width, height, format, dataType, data, genMipmaps) {
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

			//Unfortunately, requestAnimationFrame fires before img.onload events in Chrome, even
			//if the image is already 'complete' (from cache). So we need to upload 1x1
			//transparent dummy data to ensure that the user isn't trying to render 
			//a Texture that hasn't been created yet.
			self.uploadData(1, 1);

			img.onload = function() {
				self.uploadImage(img, undefined, undefined, genMipmaps);
				if (successCB)
					successCB();
			}
			img.onerror = function() {
				// console.warn("Error loading image: "+path);
				if (genMipmaps) //we gen mipmaps on the 1x1 dummy
					gl.generateMipmap(gl.TEXTURE_2D);
				if (failCB)
					failCB();
			}
			img.onabort = function() {
				// console.warn("Image load aborted: "+path);
				if (genMipmaps) //we gen mipmaps on the 1x1 dummy
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
			this._handleCreate.apply(this, this.managedArgs);
		}
	},

	/**
	 * Destroys this texture by deleting the GL resource,
	 * removing it from the WebGLContext management stack,
	 * setting its size to zero, and id and managed arguments to null.
	 * 
	 * Trying to use this texture after may lead to undefined behaviour.
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

		this.format = format || gl.RGBA;
		type = type || gl.UNSIGNED_BYTE;
		data = data || null; //make sure falsey value is null for texImage2D

		this.width = (width || width==0) ? width : this.width;
		this.height = (height || height==0) ? height : this.height;

		this._checkPOT();

		this.bind();

		gl.texImage2D(this.target, 0, this.format, 
					  this.width, this.height, 0, this.format,
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

		this.format = format || gl.RGBA;
		type = type || gl.UNSIGNED_BYTE;
		
		this.width = domObject.width;
		this.height = domObject.height;

		this._checkPOT();

		this.bind();

		gl.texImage2D(this.target, 0, this.format, this.format,
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

//Unmanaged textures:
//	HTML elements like Image, Video, Canvas
//	pixels buffer from Canvas
//	pixels array

//Need special handling:
//  context.onContextLost.add(function() {
//  	createDynamicTexture();
//  }.bind(this));

//Managed textures:
//	images specified with a path
//	this will use Image under the hood


module.exports = Texture;
},{"klasse":16,"number-util":17,"signals":18}],10:[function(require,module,exports){
var Class = require('klasse');
var Texture = require('./Texture');

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
},{"./Texture":9,"klasse":16}],11:[function(require,module,exports){
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
			if (obj && typeof obj.destroy)
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
},{"klasse":16,"signals":18}],12:[function(require,module,exports){
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
	 * @param  {[type]} width  [description]
	 * @param  {[type]} height [description]
	 * @param  {[type]} filter [description]
	 * @return {[type]}        [description]
	 */
	initialize: function FrameBuffer(context, width, height, format) { //TODO: depth component
		if (typeof context !== "object")
			throw "GL context not specified to FrameBuffer";
		this.id = null;
		this.context = context;

		//this Texture is now managed.
		this.texture = new Texture(context, width, height, format);

		//This is maanged by WebGLContext
		this.context.addManagedObject(this);
		this.create();
	},

	width: {
		get: function() {
			return this.texture.width
		}
	},

	height: {
		get: function() {
			return this.texture.height;
		}
	},

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

	destroy: function() {
		var gl = this.gl;

		if (this.texture)
			this.texture.destroy();
		if (this.id && this.gl)
			this.gl.deleteFramebuffer(this.id);
		if (this.context)
			this.context.removeManagedObject(this);

		this.id = null;
		this.texture = null;
	},

	begin: function() {
		var gl = this.gl;
		gl.viewport(0, 0, this.texture.width, this.texture.height);
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.id);
	},

	end: function() {
		var gl = this.gl;
		gl.viewport(0, 0, this.context.width, this.context.height);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	}
});

module.exports = FrameBuffer;
},{"../Texture":9,"klasse":16}],13:[function(require,module,exports){
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
		 * @property
		 * @private
		 */
		this._vertexStride = null;

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
		this._vertexStride = totalNumComponents * 4; // in bytes

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
		this.vertices = [];
		this.indices = [];
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
		var stride = this._vertexStride;

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
},{"klasse":16}],14:[function(require,module,exports){
/**
 * @module kami
 */

var Class = require('klasse');

var ShaderProgram = new Class({
	
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


	bind: function() {
		this.gl.useProgram(this.program);
	},

	destroy: function() {
		if (this.context)
			this.context.removeManagedObject(this);

		if (this.gl) {
			var gl = this.gl;
			gl.detachShader(this.vertShader);
			gl.detachShader(this.fragShader);

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
		var gl = this.gl;
		var loc = this.getUniformLocation(name);
		if (!loc) 
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
		var gl = this.gl;
		var loc = this.getUniformLocation(name);
		if (!loc) 
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
		count = count || arrayBuffer.length;
		var gl = this.gl;
		var loc = this.getUniformLocation(name);
		if (!loc) 
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
		count = count || arrayBuffer.length;
		var gl = this.gl;
		var loc = this.getUniformLocation(name);
		if (!loc) 
			return false;
		switch (count) {
			case 1: gl.uniform1iv(loc, arrayBuffer); return true;
			case 2: gl.uniform2iv(loc, arrayBuffer); return true;
			case 3: gl.uniform3iv(loc, arrayBuffer); return true;
			case 4: gl.uniform4iv(loc, arrayBuffer); return true;
			default:
				throw "invalid arguments to setUniformf"; 
		}
	}
});

module.exports = ShaderProgram;
},{"klasse":16}],15:[function(require,module,exports){
/**
  Auto-generated Kami index file.
  Created on 2013-12-20.
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
},{"./BaseBatch.js":7,"./SpriteBatch.js":8,"./Texture.js":9,"./TextureRegion.js":10,"./WebGLContext.js":11,"./glutils/FrameBuffer.js":12,"./glutils/Mesh.js":13,"./glutils/ShaderProgram.js":14}],16:[function(require,module,exports){
module.exports=require(6)
},{}],17:[function(require,module,exports){
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
	return (n & (n - 1)) == 0;
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
},{}],18:[function(require,module,exports){
module.exports=require(5)
},{}],19:[function(require,module,exports){
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
},{}],20:[function(require,module,exports){
var domready = require('domready');

var WebGLContext = require('kami').WebGLContext;
var Texture = require('kami').Texture;
var SpriteBatch = require('kami').SpriteBatch;
var ShaderProgram = require('kami').ShaderProgram;
var FrameBuffer = require('kami').FrameBuffer;
var TextureRegion = require('kami').TextureRegion;

var AssetLoader = require('kami-assets');

var fs = require('fs');

//include polyfill for requestAnimationFrame
require('raf.js');

//Browserify rocks! We can inline our GLSL like so: (brfs transform)
var vert = "//incoming Position attribute from our SpriteBatch\nattribute vec2 Position;\nattribute vec4 Color;\nattribute vec2 TexCoord0;\nuniform vec2 u_projection;\nvarying vec2 vTexCoord0;\nvarying vec4 vColor;\n\nvoid main(void) {\n   gl_Position = vec4( Position.x / u_projection.x - 1.0, Position.y / -u_projection.y + 1.0 , 0.0, 1.0);\n   vTexCoord0 = TexCoord0;\n   vColor = Color;\n}";
var frag = "#ifdef GL_ES\nprecision mediump float;\n#endif\n\n//Flat shading in four steps\n#define STEP_A 0.4\n#define STEP_B 0.6\n#define STEP_C 0.8\n#define STEP_D 1.0\n\n//attributes from vertex shader\nvarying vec4 vColor;\nvarying vec2 vTexCoord0;\n\n//our texture samplers\nuniform sampler2D u_texture0;   //diffuse map\nuniform sampler2D u_normals;   //normal map\n\n//values used for shading algorithm...\nuniform vec2 Resolution;      //resolution of canvas\nuniform vec4 AmbientColor;    //ambient RGBA -- alpha is intensity \n\nuniform vec3 LightPos;     //light position, normalized\nuniform vec4 LightColor;   //light RGBA -- alpha is intensity\nuniform vec3 Falloff;      //attenuation coefficients\nuniform float LightSize;   //the light diameter in pixels\n\n// uniform float Test[2];\n\nvoid main() {\n\t//RGBA of our diffuse color\n\tvec4 DiffuseColor = texture2D(u_texture0, vTexCoord0);\n\t\n\t//RGB of our normal map\n\tvec3 NormalMap = texture2D(u_normals, vTexCoord0).rgb;\n\t\n\t//The delta position of light\n\tvec3 LightDir = vec3(LightPos.xy - (gl_FragCoord.xy / Resolution.xy), LightPos.z);\n\t\n\t//We ensure a fixed light size in pixels like so:\n\tLightDir.x /= (LightSize / Resolution.x);\n\tLightDir.y /= (LightSize / Resolution.y);\n\n\t//Determine distance (used for attenuation) BEFORE we normalize our LightDir\n\tfloat D = length(LightDir);\n\t\n\t//normalize our vectors\n\tvec3 N = normalize(NormalMap * 2.0 - 1.0);\n\tvec3 L = normalize(LightDir);\n\n\t//We can reduce the intensity of the normal map like so:\t\t\n\tN = mix(N, vec3(0), 0.5);\n\n\t//Some normal maps may need to be inverted like so:\n\t// N.y = 1.0 - N.y;\n\t\n\t//perform \"N dot L\" to determine our diffuse term\n\tfloat df = max(dot(N, L), 0.0);\n\n\t//Pre-multiply light color with intensity\n\tvec3 Diffuse = (LightColor.rgb * LightColor.a) * df;\n\n\t//pre-multiply ambient color with intensity\n\tvec3 Ambient = AmbientColor.rgb * AmbientColor.a;\n\t\n\t//calculate attenuation\n\tfloat Attenuation = 1.0 / ( Falloff.x + (Falloff.y*D) + (Falloff.z*D*D) );\n\n\t//Here is where we apply some toon shading to the light\n\tif (Attenuation < STEP_A) \n\t\tAttenuation = 0.0;\n\telse if (Attenuation < STEP_B) \n\t\tAttenuation = STEP_B;\n\telse if (Attenuation < STEP_C) \n\t\tAttenuation = STEP_C;\n\telse \n\t\tAttenuation = STEP_D;\n\n\t//the calculation which brings it all together\n\tvec3 Intensity = Ambient + Diffuse * Attenuation;\n\tvec3 FinalColor = DiffuseColor.rgb * Intensity;\n\n\t// gl_FragColor = vec4(vec3(LightDir.x), 1.0);\n\tgl_FragColor = vColor * vec4(FinalColor, DiffuseColor.a);\n}";


var UPSCALE = 3;

domready(function() {
    //Create a new WebGL canvas with the given size
    var context = new WebGLContext(1024, 1024);

    //the 'view' is the DOM canvas, so we can just append it to our body
    document.body.appendChild( context.view );
    document.body.style.overflow = "hidden";
    document.body.style.margin = "0";
    document.body.style.background = "black";

    addCredits();

    //We use SpriteBatch to draw textures as 2D quads
    var batch = new SpriteBatch(context);

    //Create our texture. When the diffuse is loaded, we can setup our FBO and start rendering
    var texNormal  = new Texture(context, "img/pixel-normals.png");
    var texDiffuse = new Texture(context, "img/pixel-diffuse.png", start);

    //the default light Z position
    var lightZ = 0.075,
        lightSize = 256; //So the light size is independent of canvas resolution

    //parameters for the lighting shader
    var ambientColor = new Float32Array([0.8, 0.8, 0.8, 0.3]);
    var lightColor = new Float32Array([1.0, 1.0, 1.0, 1.0]);
    var falloff = new Float32Array([0.4, 7.0, 30.0]);
    var lightPos = new Float32Array([0, 0, lightZ]);


    //setup our shader
    var shader = new ShaderProgram(context, vert, frag);
    if (shader.log)
        console.warn(shader.log);

    //notice how we bind our shader before setting uniforms!
    shader.bind();
    shader.setUniformi("u_normals", 1);
    shader.setUniformf("LightSize", lightSize);

    var fbo = null,
        fboRegion = null,
        mouse = {x:0, y: -1}, //start the light off-screen...
        scroll = 0,
        time   = 0;

    window.addEventListener("mousemove", function(ev) {
        if (!fbo)
            return;

        //Since we flipped the FBO region, we need to accomodate for that.
        //We also need to adjust for the amount we are scaling the FBO
        //This is because we use gl_FragCoord in the shader
        var w = fbo.width * UPSCALE;
        var h = fbo.height * UPSCALE;

        mouse.x = ev.pageX / w;
        mouse.y = (h - ev.pageY) / h;
        
    }, true);

    window.addEventListener("resize", function(ev) {
        context.resize(window.innerWidth, window.innerHeight);
    }, true);

    var lastTime = 0,
        now = Date.now();


    //Creates the FBO texture and starts the render loop
    function start() {
        //To get crisp edges on sprites and the lights, we render our scene to a small buffer, 
        //and then up-scale it with nearest-neighbour scaling. This should be faster since we 
        //aren't processing as many fragments with our lighting shader.
        
        //We need to wait until the texture is loaded to determine its size.
        fbo = new FrameBuffer(context, texDiffuse.width, texDiffuse.height)
        
        //We now use a region to flip the texture coordinates, so it appears upright like normal
        fboRegion = new TextureRegion(fbo.texture);
        fboRegion.flip(false, true);

        requestAnimationFrame(render);
    }

    function drawScene(delta, buffer) {

        var texWidth = texDiffuse.width,
            texHeight = texDiffuse.height;

        //here we animate the light falloff a bit
        time += 0.25 * delta;
        falloff[2] = 30 - (Math.sin(time)/2+0.5)*15;
        
        //the first light will be based on mouse
        lightPos[0] = mouse.x;
        lightPos[1] = mouse.y;

        //we need to set the shader of our batch...
        batch.shader = shader;

        //We need to resize the batch to the size of the buffer we are drawing to,
        //in this case our FBO
        batch.resize(buffer.width, buffer.height);

        //Now we need to draw our sprites with the lighting shader.
        
        //this will bind our shader
        batch.begin();

        //pass our parameters to the shader. glUniform has to be called after the shader is bound!
        //Notice the resolution and light position are normalized to the WebGL canvas size
        shader.setUniformf("Resolution", fbo.width, fbo.height);
        shader.setUniformfv("AmbientColor", ambientColor);
        shader.setUniformfv("LightPos", lightPos);
        shader.setUniformfv("Falloff", falloff);
        shader.setUniformfv("LightColor", lightColor);

        texNormal.bind(1);  //bind normals to unit 1
        texDiffuse.bind(0); //bind diffuse to unit 0

        //Draw each sprite here...
        //You can use sprite sheets as long as diffuse & normal regions match
        batch.draw(texDiffuse, 0, 0, texWidth, texHeight);

        batch.end(); 
    }

    function render() {
        requestAnimationFrame(render);

        //get delta time for smooth animation
        now = Date.now();
        var delta = (now - lastTime) / 1000;
        lastTime = now;

        var gl = context.gl;

        //First, clear the main buffer (the screen)
        gl.clear(gl.COLOR_BUFFER_BIT);

        //start rendering to our FBO
        fbo.begin();

        //Now we need to clear the off-screen buffer!
        gl.clear(gl.COLOR_BUFFER_BIT);

        //draw the scene to our buffer
        drawScene(delta, fbo);

        //stop rendering to FBO, and make the screen the main buffer
        fbo.end();

        //reset to default shader
        batch.shader = batch.defaultShader;

        //set the batch to the screen size
        batch.resize(context.width, context.height);

        //now we just draw it to the screen, upscaled
        batch.begin();
        batch.drawRegion(fboRegion, 0, 0, fbo.width * UPSCALE, fbo.height * UPSCALE)
        batch.end();
    }

});

function addCredits() { //.. I should probably include this in the HTML template
    var text = document.createElement("div");
    text.className = "credits";
    text.innerHTML = '<div><a href="https://github.com/mattdesl/kami-demos">kami-demos</a></div>'
                +'platformer art by <a href="http://opengameart.org/content/platformer-art-pixel-edition">Kenney</a>';
    document.body.appendChild(text);
}
},{"domready":2,"fs":1,"kami":15,"kami-assets":3,"raf.js":19}]},{},[20])
//@ sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvcHJvamVjdHMvbnBtdXRpbHMva2FtaS1kZW1vcy9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9fZW1wdHkuanMiLCIvcHJvamVjdHMvbnBtdXRpbHMva2FtaS1kZW1vcy9ub2RlX21vZHVsZXMvZG9tcmVhZHkvcmVhZHkuanMiLCIvcHJvamVjdHMvbnBtdXRpbHMva2FtaS1kZW1vcy9ub2RlX21vZHVsZXMva2FtaS1hc3NldHMvaW5kZXguanMiLCIvcHJvamVjdHMvbnBtdXRpbHMva2FtaS1kZW1vcy9ub2RlX21vZHVsZXMva2FtaS1hc3NldHMvbm9kZV9tb2R1bGVzL2Fzc2V0bG9hZGVyL2luZGV4LmpzIiwiL3Byb2plY3RzL25wbXV0aWxzL2thbWktZGVtb3Mvbm9kZV9tb2R1bGVzL2thbWktYXNzZXRzL25vZGVfbW9kdWxlcy9hc3NldGxvYWRlci9ub2RlX21vZHVsZXMvc2lnbmFscy9kaXN0L3NpZ25hbHMuanMiLCIvcHJvamVjdHMvbnBtdXRpbHMva2FtaS1kZW1vcy9ub2RlX21vZHVsZXMva2FtaS1hc3NldHMvbm9kZV9tb2R1bGVzL2tsYXNzZS9pbmRleC5qcyIsIi9wcm9qZWN0cy9ucG11dGlscy9rYW1pLWRlbW9zL25vZGVfbW9kdWxlcy9rYW1pL2xpYi9CYXNlQmF0Y2guanMiLCIvcHJvamVjdHMvbnBtdXRpbHMva2FtaS1kZW1vcy9ub2RlX21vZHVsZXMva2FtaS9saWIvU3ByaXRlQmF0Y2guanMiLCIvcHJvamVjdHMvbnBtdXRpbHMva2FtaS1kZW1vcy9ub2RlX21vZHVsZXMva2FtaS9saWIvVGV4dHVyZS5qcyIsIi9wcm9qZWN0cy9ucG11dGlscy9rYW1pLWRlbW9zL25vZGVfbW9kdWxlcy9rYW1pL2xpYi9UZXh0dXJlUmVnaW9uLmpzIiwiL3Byb2plY3RzL25wbXV0aWxzL2thbWktZGVtb3Mvbm9kZV9tb2R1bGVzL2thbWkvbGliL1dlYkdMQ29udGV4dC5qcyIsIi9wcm9qZWN0cy9ucG11dGlscy9rYW1pLWRlbW9zL25vZGVfbW9kdWxlcy9rYW1pL2xpYi9nbHV0aWxzL0ZyYW1lQnVmZmVyLmpzIiwiL3Byb2plY3RzL25wbXV0aWxzL2thbWktZGVtb3Mvbm9kZV9tb2R1bGVzL2thbWkvbGliL2dsdXRpbHMvTWVzaC5qcyIsIi9wcm9qZWN0cy9ucG11dGlscy9rYW1pLWRlbW9zL25vZGVfbW9kdWxlcy9rYW1pL2xpYi9nbHV0aWxzL1NoYWRlclByb2dyYW0uanMiLCIvcHJvamVjdHMvbnBtdXRpbHMva2FtaS1kZW1vcy9ub2RlX21vZHVsZXMva2FtaS9saWIvaW5kZXguanMiLCIvcHJvamVjdHMvbnBtdXRpbHMva2FtaS1kZW1vcy9ub2RlX21vZHVsZXMva2FtaS9ub2RlX21vZHVsZXMvbnVtYmVyLXV0aWwvaW5kZXguanMiLCIvcHJvamVjdHMvbnBtdXRpbHMva2FtaS1kZW1vcy9ub2RlX21vZHVsZXMvcmFmLmpzL3JhZi5qcyIsIi9wcm9qZWN0cy9ucG11dGlscy9rYW1pLWRlbW9zL3NyYy9ub3JtYWxzLXBpeGVsL21haW4uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2bUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5SkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeFpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzljQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsbEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5T0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5UUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOVpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDaEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJzb3VyY2VzQ29udGVudCI6W251bGwsIi8qIVxuICAqIGRvbXJlYWR5IChjKSBEdXN0aW4gRGlheiAyMDEyIC0gTGljZW5zZSBNSVRcbiAgKi9cbiFmdW5jdGlvbiAobmFtZSwgZGVmaW5pdGlvbikge1xuICBpZiAodHlwZW9mIG1vZHVsZSAhPSAndW5kZWZpbmVkJykgbW9kdWxlLmV4cG9ydHMgPSBkZWZpbml0aW9uKClcbiAgZWxzZSBpZiAodHlwZW9mIGRlZmluZSA9PSAnZnVuY3Rpb24nICYmIHR5cGVvZiBkZWZpbmUuYW1kID09ICdvYmplY3QnKSBkZWZpbmUoZGVmaW5pdGlvbilcbiAgZWxzZSB0aGlzW25hbWVdID0gZGVmaW5pdGlvbigpXG59KCdkb21yZWFkeScsIGZ1bmN0aW9uIChyZWFkeSkge1xuXG4gIHZhciBmbnMgPSBbXSwgZm4sIGYgPSBmYWxzZVxuICAgICwgZG9jID0gZG9jdW1lbnRcbiAgICAsIHRlc3RFbCA9IGRvYy5kb2N1bWVudEVsZW1lbnRcbiAgICAsIGhhY2sgPSB0ZXN0RWwuZG9TY3JvbGxcbiAgICAsIGRvbUNvbnRlbnRMb2FkZWQgPSAnRE9NQ29udGVudExvYWRlZCdcbiAgICAsIGFkZEV2ZW50TGlzdGVuZXIgPSAnYWRkRXZlbnRMaXN0ZW5lcidcbiAgICAsIG9ucmVhZHlzdGF0ZWNoYW5nZSA9ICdvbnJlYWR5c3RhdGVjaGFuZ2UnXG4gICAgLCByZWFkeVN0YXRlID0gJ3JlYWR5U3RhdGUnXG4gICAgLCBsb2FkZWRSZ3ggPSBoYWNrID8gL15sb2FkZWR8XmMvIDogL15sb2FkZWR8Yy9cbiAgICAsIGxvYWRlZCA9IGxvYWRlZFJneC50ZXN0KGRvY1tyZWFkeVN0YXRlXSlcblxuICBmdW5jdGlvbiBmbHVzaChmKSB7XG4gICAgbG9hZGVkID0gMVxuICAgIHdoaWxlIChmID0gZm5zLnNoaWZ0KCkpIGYoKVxuICB9XG5cbiAgZG9jW2FkZEV2ZW50TGlzdGVuZXJdICYmIGRvY1thZGRFdmVudExpc3RlbmVyXShkb21Db250ZW50TG9hZGVkLCBmbiA9IGZ1bmN0aW9uICgpIHtcbiAgICBkb2MucmVtb3ZlRXZlbnRMaXN0ZW5lcihkb21Db250ZW50TG9hZGVkLCBmbiwgZilcbiAgICBmbHVzaCgpXG4gIH0sIGYpXG5cblxuICBoYWNrICYmIGRvYy5hdHRhY2hFdmVudChvbnJlYWR5c3RhdGVjaGFuZ2UsIGZuID0gZnVuY3Rpb24gKCkge1xuICAgIGlmICgvXmMvLnRlc3QoZG9jW3JlYWR5U3RhdGVdKSkge1xuICAgICAgZG9jLmRldGFjaEV2ZW50KG9ucmVhZHlzdGF0ZWNoYW5nZSwgZm4pXG4gICAgICBmbHVzaCgpXG4gICAgfVxuICB9KVxuXG4gIHJldHVybiAocmVhZHkgPSBoYWNrID9cbiAgICBmdW5jdGlvbiAoZm4pIHtcbiAgICAgIHNlbGYgIT0gdG9wID9cbiAgICAgICAgbG9hZGVkID8gZm4oKSA6IGZucy5wdXNoKGZuKSA6XG4gICAgICAgIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgdGVzdEVsLmRvU2Nyb2xsKCdsZWZ0JylcbiAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICByZXR1cm4gc2V0VGltZW91dChmdW5jdGlvbigpIHsgcmVhZHkoZm4pIH0sIDUwKVxuICAgICAgICAgIH1cbiAgICAgICAgICBmbigpXG4gICAgICAgIH0oKVxuICAgIH0gOlxuICAgIGZ1bmN0aW9uIChmbikge1xuICAgICAgbG9hZGVkID8gZm4oKSA6IGZucy5wdXNoKGZuKVxuICAgIH0pXG59KVxuIiwiLy9UaGlzIGlzIGFuIGFzc2V0IGxvYWRlciBxdWV1ZSB0YWlsb3JlZCBmb3IgS2FtaS9XZWJHTFxuXG52YXIgTG9hZGVyQmFzZSA9IHJlcXVpcmUoJ2Fzc2V0bG9hZGVyJyk7XG52YXIgQ2xhc3MgPSByZXF1aXJlKCdrbGFzc2UnKTtcbnZhciBUZXh0dXJlID0gcmVxdWlyZSgna2FtaScpLlRleHR1cmU7XG5cbi8vdGhpcyBpcyBhIGthbWktc3BlY2lmaWMgbG9hZGVyIGZvciBhIFRleHR1cmUgb2JqZWN0XG4vL2l0IGlzIGFzc3VtZWQgdGhhdCB0aGUgQXNzZXRNYW5hZ2VyIGJlaW5nIHBhc3NlZCBpcyBhIFdlYkdMQ29udGV4dFxuZnVuY3Rpb24gVGV4dHVyZUxvYWRlcihuYW1lLCBwYXRoLCB0ZXh0dXJlLCBnZW5NaXBtYXBzKSB7XG4gICAgcGF0aCA9IHBhdGggfHwgbmFtZTtcblxuICAgIHRleHR1cmUgPSB0ZXh0dXJlIHx8IG5ldyBUZXh0dXJlKHRoaXMuY29udGV4dCk7XG4gICAgXG4gICAgcmV0dXJuIHtcblxuICAgICAgICB2YWx1ZTogdGV4dHVyZSxcblxuICAgICAgICBsb2FkOiBmdW5jdGlvbihmaW5pc2hlZCkge1xuICAgICAgICAgICAgdmFyIGltZyA9IG5ldyBJbWFnZSgpOyBcblxuICAgICAgICAgICAgaW1nLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIGltZy5vbmVycm9yID0gaW1nLm9uYWJvcnQgPSBudWxsOyAvL2NsZWFyIG90aGVyIGxpc3RlbmVyc1xuICAgICAgICAgICAgICAgIHRleHR1cmUudXBsb2FkSW1hZ2UoaW1nLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgZ2VuTWlwbWFwcyk7XG4gICAgICAgICAgICAgICAgZmluaXNoZWQoKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBpbWcub25lcnJvciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIGltZy5vbmxvYWQgPSBpbWcub25hYm9ydCA9IG51bGw7XG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKFwiRXJyb3IgbG9hZGluZyBpbWFnZTogXCIrcGF0aCk7XG4gICAgICAgICAgICAgICAgLy9XZSB1c2UgbnVsbCBkYXRhIHRvIGF2b2lkIFdlYkdMIGVycm9yc1xuICAgICAgICAgICAgICAgIHRleHR1cmUudXBsb2FkRGF0YSgxLCAxLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBnZW5NaXBtYXBzKTsgXG4gICAgICAgICAgICAgICAgZmluaXNoZWQoZmFsc2UpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGltZy5vbmFib3J0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgaW1nLm9ubG9hZCA9IGltZy5vbmVycm9yID0gbnVsbDtcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oXCJBYm9ydGVkIGltYWdlOiBcIitwYXRoKTtcbiAgICAgICAgICAgICAgICAvL1dlIHVzZSBudWxsIGRhdGEgdG8gYXZvaWQgV2ViR0wgZXJyb3JzXG4gICAgICAgICAgICAgICAgdGV4dHVyZS51cGxvYWREYXRhKDEsIDEsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIGdlbk1pcG1hcHMpOyBcbiAgICAgICAgICAgICAgICBmaW5pc2hlZChmYWxzZSk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgLy9zZXR1cCBzb3VyY2VcbiAgICAgICAgICAgIGltZy5zcmMgPSBwYXRoO1xuICAgICAgICB9XG4gICAgfVxufVxuXG4vL1NldHVwIGxvYWRlciBwYXJhbWV0ZXJzXG5UZXh0dXJlTG9hZGVyLmV4dGVuc2lvbnMgPSBbXCJwbmdcIiwgXCJnaWZcIiwgXCJqcGdcIiwgXCJqcGVnXCJdO1xuVGV4dHVyZUxvYWRlci5tZWRpYVR5cGUgPSBcImltYWdlXCI7XG5cbnZhciBBc3NldExvYWRlciA9IG5ldyBDbGFzcyh7XG5cbiAgICBFeHRlbmRzOiBMb2FkZXJCYXNlLFxuXG4gICAgaW5pdGlhbGl6ZTogZnVuY3Rpb24oY29udGV4dCkge1xuICAgICAgICBMb2FkZXJCYXNlLmNhbGwodGhpcyk7XG5cbiAgICAgICAgaWYgKCFjb250ZXh0KVxuICAgICAgICAgICAgdGhyb3cgXCJLYW1pIEFzc2V0TG9hZGVyIG11c3QgYmUgcGFzc2VkIHdpdGggYSB2YWxpZCBXZWJHTENvbnRleHRcIjtcblxuICAgICAgICB0aGlzLnJlZ2lzdGVyTG9hZGVyKFRleHR1cmVMb2FkZXIpO1xuXG4gICAgICAgIHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XG4gICAgICAgIHRoaXMuX19pbnZhbGlkYXRlRnVuYyA9IHRoaXMuaW52YWxpZGF0ZS5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLmNvbnRleHQucmVzdG9yZWQuYWRkKCB0aGlzLl9faW52YWxpZGF0ZUZ1bmMgKTtcbiAgICB9LFxuXG4gICAgZGVzdHJveTogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuY29udGV4dC5yZXN0b3JlZC5yZW1vdmUodGhpcy5fX2ludmFsaWRhdGVGdW5jKTtcbiAgICB9XG59KTtcblxuLy9Db3B5IHN0YXRpYyBhdHRyaWJ1dGVzIC4uLlxuQXNzZXRMb2FkZXIuU3RhdHVzID0gTG9hZGVyQmFzZS5TdGF0dXM7XG5cbkFzc2V0TG9hZGVyLnJlZ2lzdGVyQ29tbW9uTG9hZGVyID0gTG9hZGVyQmFzZS5yZWdpc3RlckNvbW1vbkxvYWRlcjtcblxuQXNzZXRMb2FkZXIuRGVzY3JpcHRvciA9IExvYWRlckJhc2UuRGVzY3JpcHRvcjtcblxuQXNzZXRMb2FkZXIuVGV4dHVyZUxvYWRlciA9IFRleHR1cmVMb2FkZXI7XG5cbm1vZHVsZS5leHBvcnRzID0gQXNzZXRMb2FkZXI7XG5cblxuXG5cblxuXG5cblxuLy8vIG9sZCBkb2NzLiBcblxuICAgIC8qKlxuICAgICAqIFRoaXMgaXMgdGhlIGxvYWRpbmcgZnVuY3Rpb24gb2YgYSBBc3NldE1hbmFnZXIgcGx1Z2luLCBcbiAgICAgKiB3aGljaCBoYW5kbGVzIHRoZSBhc3luY2hyb25vdXMgbG9hZGluZyBmb3IgYW4gYXNzZXQuIFxuICAgICAqIFRoZSBmdW5jdGlvbiBtdXN0IGJlIGltcGxlbWVudGVkIGluIGEgdmVyeVxuICAgICAqIHN0cmljdCBtYW5uZXIgZm9yIHRoZSBhc3NldCBtYW5hZ2VyIHRvIHdvcmsgY29ycmVjdGx5LlxuICAgICAqXG4gICAgICogT25jZSB0aGUgYXN5bmMgbG9hZGluZyBpcyBkb25lLCB5b3UgbXVzdCBjYWxsIHRoZSBgZmluaXNoZWRgIGNhbGxiYWNrXG4gICAgICogdGhhdCB3YXMgcGFzc2VkIHRvIHRoaXMgbWV0aG9kLiBZb3UgY2FuIHBhc3MgdGhlIHBhcmFtZXRlciBgZmFsc2VgIHRvIHRoZVxuICAgICAqIGZpbmlzaGVkIGNhbGxiYWNrIHRvIGluZGljYXRlIHRoZSBhc3luYyBsb2FkIGhhcyBmYWlsZWQuIE90aGVyd2lzZSwgaXQgaXMgYXNzdW1lZFxuICAgICAqIHRvIGJlIHN1Y2Nlc3NmdWwuXG4gICAgICogXG4gICAgICogSWYgeW91IGRvbid0IGludm9rZSB0aGUgY2FsbGJhY2ssIHRoZSBhc3NldCBtYW5hZ2VyIG1heSBuZXZlciBmaW5pc2ggbG9hZGluZy5cbiAgICAgKiBcbiAgICAgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWUgdGhlIG5hbWUgb2YgdGhlIGFzc2V0IHRvIGxvYWRcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmaW5pc2hlZCB0aGUgZnVuY3Rpb24gdG8gY2FsbCB3aGVuIGFzeW5jIGxvYWRpbmcgaXMgY29tcGxldGVcbiAgICAgKiBAcGFyYW0ge1RleHR1cmV9IHRleHR1cmUgdGhlIHRleHR1cmUgdG8gb3BlcmF0ZSBvbiBmb3IgdGhpcyBhc3NldFxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIHRoZSBvcHRpb25hbCBpbWFnZSBwYXRoIHRvIHVzZSBpbnN0ZWFkIG9mIHRoZSBgbmFtZWAgcGFyYW1ldGVyXG4gICAgICovXG4vKipcbiAqIFRoaXMgaXMgdGhlIGRlZmF1bHQgaW1wbGVtZW50YXRpb24gb2YgYW4gaW1hZ2UgbG9hZGVyIHBsdWdpbiBmb3IgQXNzZXRNYW5hZ2VyLlxuICogVGhpcyB1c2VzIGEgRE9NIEltYWdlIG9iamVjdCB0byB1cGxvYWQgUE5HLCBHSUYgYW5kIEpQRyBpbWFnZXMgdG8gYSBXZWJHTFxuICogdGV4dHVyZS4gWW91IHdpbGwgbm90IG5lZWQgdG8gZGVhbCB3aXRoIHRoaXMgY2xhc3MgZGlyZWN0bHksIHVubGVzcyB5b3Ugd2FudFxuICogdG8gd3JpdGUgeW91ciBvd24gQXNzZXRNYW5hZ2VyIGxvYWRlcnMuXG4gKlxuICogQSBMb2FkZXIgcGx1Z2luIGlzIGEgY2xhc3Mgd2hpY2ggaGFuZGxlcyB0aGUgYXN5bmNocm9ub3VzIGxvYWRpbmcgYW5kIHByb3ZpZGVzXG4gKiBhIGNvbnZlbmllbnQgcmV0dXJuIHZhbHVlIGZvciB0aGUgYEFzc2V0TWFuYWdlci5sb2FkKClgIGZ1bmN0aW9ucy4gVGhlIGxvYWRlciBjbGFzc1xuICogaXMgY29uc3RydWN0ZWQgd2l0aCB0aGUgZm9sbG93aW5nIHBhcmFtZXRlcnM6IGZpcnN0LCB0aGUgV2ViR0xDb250ZXh0IHRoaXMgQXNzZXRNYW5hZ2VyXG4gKiBpcyB1c2luZywgYW5kIHNlY29uZCwgdGhlIG5hbWUgb2YgdGhlIGFzc2V0IHRvIGJlIGxvYWRlZC4gVGhlIHN1YnNlcXVlbnQgYXJndW1lbnRzIGFyZVxuICogdGhvc2UgdGhhdCB3ZXJlIHBhc3NlZCBhcyBleHRyYSB0byB0aGUgYEFzc2V0TWFuYWdlci5sb2FkKClgIGZ1bmN0aW9ucy5cbiAqXG4gKiBBIGxvYWRlciBtdXN0IGltcGxlbWVudCBhIGBsb2FkKClgIGZ1bmN0aW9uLCBhbmQgaXQncyBlbmNvdXJhZ2VkIHRvIGFsc28gaW1wbGVtZW50IGEgXG4gKiBgZ2V0UmV0dXJuVmFsdWUoKWAgZnVuY3Rpb24sIGZvciBjb252ZW5pZW5jZS5cbiAqIFxuICogQHBhcmFtIHtXZWJHTENvbnRleHR9IGNvbnRleHQgdGhlIGNvbnRleHQsIHBhc3NlZCBieSBBc3NldE1hbmFnZXJcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIHRoZSB1bmlxdWUga2V5IGZvciB0aGlzIGFzc2V0XG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aCB0aGUgb3B0aW9uYWwgcGF0aCBvciBkYXRhIFVSSSB0byB1c2UsIHdpbGwgZGVmYXVsdCB0byB0aGUgbmFtZSBwYXJhbVxuICogQHBhcmFtIHtUZXh0dXJlfSB0ZXh0dXJlIGFuIG9wdGlvbmFsIHRleHR1cmUgdG8gYWN0IG9uOyBpZiB1bmRlZmluZWQsIGEgbmV3IHRleHR1cmVcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICB3aWxsIGJlIGNyZWF0ZWRcbiAqLyIsInZhciBDbGFzcyA9IHJlcXVpcmUoJ2tsYXNzZScpO1xudmFyIFNpZ25hbCA9IHJlcXVpcmUoJ3NpZ25hbHMnKTtcblxuZnVuY3Rpb24gcmVnaXN0ZXJMb2FkZXIobG9hZGVycywgbG9hZGVyRnVuYywgZXh0ZW5zaW9ucywgbWVkaWFUeXBlKSB7XG5cdGlmICghbG9hZGVyRnVuYyB8fCAhZXh0ZW5zaW9ucyB8fCAhZXh0ZW5zaW9ucy5sZW5ndGgpXG5cdFx0dGhyb3cgXCJtdXN0IHNwZWNpZnkgYXQgbGVhc3Qgb25lIGV4dGVuc2lvbiBmb3IgdGhlIGxvYWRlclwiO1xuXHRcblx0Zm9yICh2YXIgaT0wOyBpPGV4dGVuc2lvbnMubGVuZ3RoOyBpKyspIHtcblx0XHRsb2FkZXJzWyBleHRlbnNpb25zW2ldIF0gPSBsb2FkZXJGdW5jO1xuXHRcdGlmIChtZWRpYVR5cGUpIFxuXHRcdFx0bG9hZGVyc1sgbWVkaWFUeXBlICsgJy8nICsgZXh0ZW5zaW9uc1tpXSBdID0gbG9hZGVyRnVuYztcblx0fVxufVxuXG4vKipcbiAqIFRoaXMgaXMgYSBiYXNlIGNsYXNzIGZvciBhc3NldCBtYW5hZ2VtZW50OyBpZGVhbCBmb3IgZWl0aGVyXG4gKiBnZW5lcmljIEhUTUw1IDJEIGNhbnZhcyBvciBXZWJHTCBjYW52YXMuXG4gKiBcbiAqIEBjbGFzcyAgQXNzZXRMb2FkZXJcbiAqIEBjb25zdHJ1Y3RvciBcbiAqL1xudmFyIEFzc2V0TG9hZGVyID0gbmV3IENsYXNzKHtcblx0XG5cdC8qKlxuXHQgKiBBIHJlYWQtb25seSBwcm9wZXJ0eSB0aGF0IGRlc2NyaWJlcyB0aGUgbnVtYmVyIG9mIFxuXHQgKiBhc3NldHMgcmVtYWluaW5nIHRvIGJlIGxvYWRlZC5cblx0ICpcblx0ICogQGF0dHJpYnV0ZSByZW1haW5pbmdcblx0ICogQHR5cGUge051bWJlcn1cblx0ICogQHJlYWRPbmx5XG5cdCAqL1xuXHRyZW1haW5pbmc6IHtcblx0XHRnZXQ6IGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX19sb2FkQ291bnQ7XG5cdFx0fVxuXHR9LFxuXG5cdC8qKlxuXHQgKiBBIHJlYWQtb25seSBwcm9wZXJ0eSB0aGF0IGRlc2NyaWliZXMgdGhlIHRvdGFsXG5cdCAqIG51bWJlciBvZiBhc3NldHMgaW4gdGhpcyBBc3NldExvYWRlci5cblx0ICogXG5cdCAqIEBhdHRyaWJ1dGUgdG90YWxcblx0ICogQHJlYWRPbmx5XG5cdCAqIEB0eXBlIHtOdW1iZXJ9XG5cdCAqL1xuXHR0b3RhbDoge1xuXHRcdGdldDogZnVuY3Rpb24oKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fX3RvdGFsSXRlbXM7XG5cdFx0fVxuXHR9LFxuXG5cdC8vQ29uc3RydWN0b3Jcblx0aW5pdGlhbGl6ZTogZnVuY3Rpb24gQXNzZXRMb2FkZXIoKSB7XG5cblx0XHQvKipcblx0XHQgKiBBbiBhcnJheSBvZiBEZXNjcmlwdG9ycyB0aGF0IHRoaXMgcXVldWUgaXMgaGFuZGxpbmcuXG5cdFx0ICogVGhpcyBzaG91bGQgbm90IGJlIG1vZGlmaWVkIGRpcmVjdGx5LlxuXHRcdCAqIFxuXHRcdCAqIEBwcm9wZXJ0eSBhc3NldHNcblx0XHQgKiBAdHlwZSB7QXJyYXl9XG5cdFx0ICovXG5cdFx0dGhpcy5hc3NldHMgPSBbXTtcblxuXHRcdC8qKlxuXHRcdCAqIFRoZSBxdWV1ZSBvZiB0YXNrcyB0byBsb2FkLiBFYWNoIGNvbnRhaW5zXG5cdFx0ICogYW5cblx0XHQgKiB7eyNjcm9zc0xpbmsgXCJBc3NldExvYWRlci5EZXNjcmlwdG9yXCJ9fXt7L2Nyb3NzTGlua319LlxuXHRcdCAqXG5cdFx0ICogTG9hZGluZyBhIHRhc2sgd2lsbCBwb3AgaXQgb2ZmIHRoaXMgbGlzdCBhbmQgZmlyZSB0aGUgYXN5bmNcblx0XHQgKiBvciBzeW5jaHJvbm91cyBwcm9jZXNzLlxuXHRcdCAqXG5cdFx0ICogVGhpcyBzaG91bGQgbm90IGJlIG1vZGlmaWVkIGRpcmVjdGx5LlxuXHRcdCAqXG5cdFx0ICogQHByb3BlcnR5IHRhc2tzXG5cdFx0ICogQHByb3RlY3RlZFxuXHRcdCAqIEB0eXBlIHtBcnJheX1cblx0XHQgKi9cblx0XHR0aGlzLnRhc2tzID0gW107XG5cblx0XHQvL1ByaXZhdGUgc3R1ZmYuLi4gZG8gbm90IHRvdWNoIVxuXG5cdFx0dGhpcy5fX2xvYWRDb3VudCA9IDA7XG5cdFx0dGhpcy5fX3RvdGFsSXRlbXMgPSAwO1xuXG5cdFx0Ly8gU2lnbmFscyBcblx0XHRcblx0XHQvKipcblx0XHQgKiBBIHNpZ25hbCBkaXNwYXRjaGVkIHdoZW4gbG9hZGluZyBmaXJzdCBiZWdpbnMsIFxuXHRcdCAqIGkuZS4gd2hlbiB1cGRhdGUoKSBpcyBjYWxsZWQgYW5kIHRoZSBsb2FkaW5nIHF1ZXVlIGlzIHRoZVxuXHRcdCAqIHNhbWUgc2l6ZSBhcyB0aGUgdG90YWwgYXNzZXQgbGlzdC5cblx0XHQgKlxuXHRcdCAqIEBldmVudCBsb2FkU3RhcnRlZFxuXHRcdCAqIEB0eXBlIHtTaWduYWx9XG5cdFx0ICovXG5cdFx0dGhpcy5sb2FkU3RhcnRlZCA9IG5ldyBTaWduYWwoKTtcblxuXHRcdC8qKlxuXHRcdCAqIEEgc2lnbmFsIGRpc3BhdGNoZWQgd2hlbiBhbGwgYXNzZXRzIGhhdmUgYmVlbiBsb2FkZWRcblx0XHQgKiAoaS5lLiB0aGVpciBhc3luYyB0YXNrcyBmaW5pc2hlZCkuXG5cdFx0ICpcblx0XHQgKiBAZXZlbnQgbG9hZEZpbmlzaGVkXG5cdFx0ICogQHR5cGUge1NpZ25hbH1cblx0XHQgKi9cblx0XHR0aGlzLmxvYWRGaW5pc2hlZCA9IG5ldyBTaWduYWwoKTtcblxuXHRcdC8qKlxuXHRcdCAqIEEgc2lnbmFsIGRpc3BhdGNoZWQgb24gcHJvZ3Jlc3MgdXBkYXRlcywgb25jZSBhbiBhc3NldFxuXHRcdCAqIGhhcyBiZWVuIGxvYWRlZCBpbiBmdWxsIChpLmUuIGl0cyBhc3luYyB0YXNrIGZpbmlzaGVkKS5cblx0XHQgKlxuXHRcdCAqIFRoaXMgcGFzc2VzIGFuIGV2ZW50IG9iamVjdCB0byB0aGUgbGlzdGVuZXIgZnVuY3Rpb25cblx0XHQgKiB3aXRoIHRoZSBmb2xsb3dpbmcgcHJvcGVydGllczpcblx0XHQgKiBcblx0XHQgKiAtIGBjdXJyZW50YCBudW1iZXIgb2YgYXNzZXRzIHRoYXQgaGF2ZSBiZWVuIGxvYWRlZFxuXHRcdCAqIC0gYHRvdGFsYCBudW1iZXIgb2YgYXNzZXRzIHRvIGxvYWRlZFxuXHRcdCAqIC0gYG5hbWVgIG9mIHRoZSBhc3NldCB3aGljaCB3YXMganVzdCBsb2FkZWRcblx0XHQgKiAgXG5cdFx0ICogQGV2ZW50IGxvYWRQcm9ncmVzc1xuXHRcdCAqIEB0eXBlIHtbdHlwZV19XG5cdFx0ICovXG5cdFx0dGhpcy5sb2FkUHJvZ3Jlc3MgPSBuZXcgU2lnbmFsKCk7XG5cblx0XHQvKipcblx0XHQgKiBBIHNpZ25hbCBkaXNwYXRjaGVkIG9uIHByb2JsZW1hdGljIGxvYWQ7IGUuZy4gaWZcblx0XHQgKiB0aGUgaW1hZ2Ugd2FzIG5vdCBmb3VuZCBhbmQgXCJvbmVycm9yXCIgd2FzIHRyaWdnZXJlZC4gXG5cdFx0ICogVGhlIGZpcnN0IGFyZ3VtZW50IHBhc3NlZCB0byB0aGUgbGlzdGVuZXIgd2lsbCBiZSBcblx0XHQgKiB0aGUgc3RyaW5nIG5hbWUgb2YgdGhlIGFzc2V0LlxuXHRcdCAqXG5cdFx0ICogVGhlIGFzc2V0IG1hbmFnZXIgd2lsbCBjb250aW51ZSBsb2FkaW5nIHN1YnNlcXVlbnQgYXNzZXRzLlxuXHRcdCAqXG5cdFx0ICogVGhpcyBpcyBkaXNwYXRjaGVkIGFmdGVyIHRoZSBzdGF0dXMgb2YgdGhlIGFzc2V0IGlzXG5cdFx0ICogc2V0IHRvIFN0YXR1cy5MT0FEX0ZBSUwsIGFuZCBiZWZvcmUgdGhlIGxvYWRQcm9ncmVzc1xuXHRcdCAqIHNpZ25hbCBpcyBkaXNwYXRjaGVkLlxuXHRcdCAqXG5cdFx0ICogQGV2ZW50IGxvYWRFcnJvclxuXHRcdCAqIEB0eXBlIHtTaWduYWx9XG5cdFx0ICovXG5cdFx0dGhpcy5sb2FkRXJyb3IgPSBuZXcgU2lnbmFsKCk7XG5cblxuXHRcdC8qKlxuXHRcdCAqIEEgc2V0IG9mIGxvYWRlciBwbHVnaW5zIGZvciB0aGlzIGFzc2V0IG1hbmFnZXIuIFRoZXNlIG1pZ2h0IGJlIGFzIHNpbXBsZVxuXHRcdCAqIGFzIHB1c2hpbmcgSFRNTCBJbWFnZSBvYmplY3RzIGludG8gYSBUZXh0dXJlLCBvciBtb3JlIGNvbXBsZXggbGlrZSBkZWNvZGluZ1xuXHRcdCAqIGEgY29tcHJlc3NlZCwgbWlwLW1hcHBlZCwgb3IgY3ViZS1tYXAgdGV4dHVyZS5cblx0XHQgKlxuXHRcdCAqIFRoaXMgb2JqZWN0IGlzIGEgc2ltcGxlIGhhc2htYXAgb2YgbG93ZXItY2FzZSBleHRlbnNpb24gbmFtZXMgdG8gTG9hZGVyIGZ1bmN0aW9ucyxcblx0XHQgKiBhbmQgbWltZS10eXBlcyBsaWtlIFwiaW1hZ2UvcG5nXCIgZm9yIGRhdGEgVVJJcy5cblx0XHQgKiBcblx0XHQgKiBAcHJvcGVydHkgbG9hZGVyc1xuXHRcdCAqIEB0eXBlIHtPYmplY3R9XG5cdFx0ICovXG5cdFx0dGhpcy5sb2FkZXJzID0ge307XG5cblx0XHQvL2NvcHkgZnJvbSBvdXIgY29tbW9uIGxvYWRlcnNcblx0XHRmb3IgKHZhciBrIGluIEFzc2V0TG9hZGVyLmNvbW1vbkxvYWRlcnMpIHtcblx0XHRcdGlmIChBc3NldExvYWRlci5jb21tb25Mb2FkZXJzLmhhc093blByb3BlcnR5KGspKSB7XG5cdFx0XHRcdHRoaXMubG9hZGVyc1trXSA9IEFzc2V0TG9hZGVyLmNvbW1vbkxvYWRlcnNba107XG5cdFx0XHR9XG5cdFx0fVxuXHR9LFxuXG5cdC8qKlxuXHQgKiBEZXN0cm95cyB0aGlzIGFzc2V0IG1hbmFnZXI7IGRlbGV0aW5nIHRoZSB0YXNrc1xuXHQgKiBhbmQgYXNzZXRzIGFycmF5cyBhbmQgcmVzZXR0aW5nIHRoZSBsb2FkIGNvdW50LlxuXHQgKiBcblx0ICogQG1ldGhvZCAgZGVzdHJveVxuXHQgKi9cblx0ZGVzdHJveTogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5yZW1vdmVBbGwoKTtcblx0fSxcblxuXHQvKipcblx0ICogQ2FsbGVkIHRvIGludmFsaWRhdGUgdGhlIGFzc2V0IG1hbmFnZXJcblx0ICogYW5kIHJlcXVpcmUgYWxsIGFzc2V0cyB0byBiZSByZS1sb2FkZWQuXG5cdCAqIEZvciBleGFtcGxlLCBhIFdlYkdMIGFwcCB3aWxsIGNhbGwgdGhpcyBpbnRlcm5hbGx5XG5cdCAqIG9uIGNvbnRleHQgbG9zcy5cblx0ICpcblx0ICogQHByb3RlY3RlZFxuXHQgKiBAbWV0aG9kIGludmFsaWRhdGVcblx0ICovXG5cdGludmFsaWRhdGU6IGZ1bmN0aW9uKCkge1xuXHRcdC8vbWFyayBhbGwgYXMgbm90IHlldCBsb2FkZWRcblx0XHRmb3IgKHZhciBpPTA7IGk8dGhpcy5hc3NldHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdHRoaXMuYXNzZXRzW2ldLnN0YXR1cyA9IEFzc2V0TG9hZGVyLlN0YXR1cy5RVUVVRUQ7XG5cdFx0fVxuXHRcdFxuXHRcdC8vY29weSBvdXIgYXNzZXRzIHRvIGEgcXVldWUgd2hpY2ggY2FuIGJlIHBvcHBlZFxuXHRcdHRoaXMudGFza3MgPSB0aGlzLmFzc2V0cy5zbGljZSgpO1xuXG5cdFx0dGhpcy5fX2xvYWRDb3VudCA9IHRoaXMuX190b3RhbEl0ZW1zID0gdGhpcy50YXNrcy5sZW5ndGg7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEF0dGVtcHRzIHRvIGV4dHJhY3QgYSBtaW1lLXR5cGUgZnJvbSB0aGUgZ2l2ZW4gZGF0YSBVUkkuIEl0IHdpbGxcblx0ICogZGVmYXVsdCB0byBcInRleHQvcGxhaW5cIiBpZiB0aGUgc3RyaW5nIGlzIGEgZGF0YSBVUkkgd2l0aCBubyBzcGVjaWZpZWRcblx0ICogbWltZS10eXBlLiBJZiB0aGUgc3RyaW5nIGRvZXMgbm90IGJlZ2luIHdpdGggXCJkYXRhOlwiLCB0aGlzIG1ldGhvZCBcblx0ICogcmV0dXJucyBudWxsLlxuXHQgKlxuXHQgKiBAbWV0aG9kICBfX2dldERhdGFUeXBlXG5cdCAqIEBwcml2YXRlXG5cdCAqIEBwYXJhbSAge1N0cmluZ30gc3RyIHRoZSBkYXRhIFVSSVxuXHQgKiBAcmV0dXJuIHtTdHJpbmd9ICAgICB0aGUgbWltZSB0eXBlXG5cdCAqL1xuXHRfX2dldERhdGFUeXBlOiBmdW5jdGlvbihzdHIpIHtcblx0XHR2YXIgdGVzdCA9IFwiZGF0YTpcIjtcblx0XHQvL3N0YXJ0cyB3aXRoICdkYXRhOidcblx0XHR2YXIgc3RhcnQgPSBzdHIuc2xpY2UoMCwgdGVzdC5sZW5ndGgpLnRvTG93ZXJDYXNlKCk7XG5cdFx0aWYgKHN0YXJ0ID09IHRlc3QpIHtcblx0XHRcdHZhciBkYXRhID0gc3RyLnNsaWNlKHRlc3QubGVuZ3RoKTtcblx0XHRcdFxuXHRcdFx0dmFyIHNlcElkeCA9IGRhdGEuaW5kZXhPZignLCcpO1xuXHRcdFx0aWYgKHNlcElkeCA9PT0gLTEpIC8vbWFsZm9ybWVkIGRhdGEgVVJJIHNjaGVtZVxuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblxuXHRcdFx0Ly9lLmcuIFwiaW1hZ2UvZ2lmO2Jhc2U2NFwiID0+IFwiaW1hZ2UvZ2lmXCJcblx0XHRcdHZhciBpbmZvID0gZGF0YS5zbGljZSgwLCBzZXBJZHgpLnNwbGl0KCc7JylbMF07XG5cblx0XHRcdC8vV2UgbWlnaHQgbmVlZCB0byBoYW5kbGUgc29tZSBzcGVjaWFsIGNhc2VzIGhlcmUuLi5cblx0XHRcdC8vc3RhbmRhcmRpemUgdGV4dC9wbGFpbiB0byBcInR4dFwiIGZpbGUgZXh0ZW5zaW9uXG5cdFx0XHRpZiAoIWluZm8gfHwgaW5mby50b0xvd2VyQ2FzZSgpID09IFwidGV4dC9wbGFpblwiKVxuXHRcdFx0XHRyZXR1cm4gXCJ0eHRcIlxuXG5cdFx0XHQvL1VzZXIgc3BlY2lmaWVkIG1pbWUgdHlwZSwgdHJ5IHNwbGl0dGluZyBpdCBieSAnLydcblx0XHRcdHJldHVybiBpbmZvLnNwbGl0KCcvJykucG9wKCkudG9Mb3dlckNhc2UoKTtcblx0XHR9XG5cdFx0cmV0dXJuIG51bGw7XG5cdH0sXG5cblx0X19leHRlbnNpb246IGZ1bmN0aW9uKHN0cikge1xuXHRcdHZhciBpZHggPSBzdHIubGFzdEluZGV4T2YoJy4nKTtcblx0XHRpZiAoaWR4ID09PSAtMSB8fCBpZHggPT09IDAgfHwgaWR4ID09PSBzdHIubGVuZ3RoLTEpIC8vIGRvZXMgbm90IGhhdmUgYSBjbGVhciBmaWxlIGV4dGVuc2lvblxuXHRcdFx0cmV0dXJuIFwiXCI7XG5cdFx0cmV0dXJuIHN0ci5zdWJzdHJpbmcoaWR4KzEpLnRvTG93ZXJDYXNlKCk7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFJldHVybnMgdGhlIEFzc2V0RGVzY3JpcHRvciBieSBuYW1lLCBvciBudWxsIGlmIG5vdCBmb3VuZC5cblx0ICogXG5cdCAqIEBtZXRob2QgIGdldERlc2NyaXB0b3Jcblx0ICogQHByb3RlY3RlZFxuXHQgKiBAcGFyYW0gIHtBc3NldERlc2NyaXB0b3J9IG5hbWUgdGhlIG5hbWUgb2YgdGhlIGFzc2V0XG5cdCAqIEByZXR1cm4ge2FueX0gICAgICB0aGUgYXNzZXRcblx0ICovXG5cdGdldERlc2NyaXB0b3I6IGZ1bmN0aW9uKG5hbWUpIHtcblx0XHR2YXIgaWR4ID0gdGhpcy5pbmRleE9mKHRoaXMuYXNzZXRzLCBuYW1lKTtcblx0XHRyZXR1cm4gaWR4ICE9PSAtMSA/IHRoaXMuYXNzZXRzW2lkeF0gOiBudWxsO1xuXHR9LFxuXG5cdGdldFN0YXR1czogZnVuY3Rpb24obmFtZSkge1xuXHRcdHZhciBkID0gdGhpcy5nZXREZXNjcmlwdG9yKG5hbWUpO1xuXHRcdHJldHVybiBkID8gZC5zdGF0dXMgOiBudWxsO1xuXHR9LFxuXHRcblx0aXNMb2FkZWQ6IGZ1bmN0aW9uKG5hbWUpIHtcblx0XHRyZXR1cm4gdGhpcy5nZXRTdGF0dXMobmFtZSkgPT09IEFzc2V0TG9hZGVyLlN0YXR1cy5MT0FEX1NVQ0NFU1M7XG5cdH0sXG5cdFxuXHQvKipcblx0ICogUmV0dXJucyB0aGUgdmFsdWUgc3RvcmVkIGZvciB0aGlzIGFzc2V0LCBzdWNoIGFzIGFuIEltYWdlXG5cdCAqIGlmIHdlIGFyZSB1c2luZyBhIENhbnZhcyBpbWFnZSBsb2FkaW5nIHBsdWdpbi4gUmV0dXJucyBudWxsXG5cdCAqIGlmIHRoZSBhc3NldCB3YXMgbm90IGZvdW5kLlxuXHQgKiBcdFxuXHQgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWUgdGhlIG5hbWUgb2YgdGhlIGFzc2V0IHRvIGdldFxuXHQgKiBAcmV0dXJuIHthbnl9ICAgIHRoZSBhc3NldCBieSBuYW1lXG5cdCAqL1xuXHRnZXQ6IGZ1bmN0aW9uKG5hbWUpIHtcblx0XHR2YXIgZCA9IHRoaXMuZ2V0RGVzY3JpcHRvcihuYW1lKTtcblx0XHRyZXR1cm4gZCA/IGQudmFsdWUgOiBudWxsO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBSZW1vdmVzIGEgcmVmZXJlbmNlIHRvIHRoZSBnaXZlbiBhc3NldCwgYW5kIHJldHVybnMgdGhlIHJlbW92ZWRcblx0ICogYXNzZXQuIElmIHRoZSBhc3NldCBieSBuYW1lIHdhcyBub3QgZm91bmQsIG51bGwgaXMgcmV0dXJuZWQuXG5cdCAqXG5cdCAqIFRoaXMgd2lsbCBhbHNvIHJlbW92ZSB0aGUgYXNzZXQgZnJvbSB0aGUgdGFzayBsaXN0LlxuXHQgKlxuXHQgKiBOb3RlIHRoYXQgdGhpcyB3aWxsIG5vdCBkZXN0cm95IGFueSByZXNvdXJjZXMgdGhhdCBhc3NldCBtYWludGFpbmVkO1xuXHQgKiBzbyBpdCBpcyB0aGUgdXNlcidzIGR1dHkgdG8gZG8gc28gYWZ0ZXIgcmVtb3ZpbmcgaXQgZnJvbSB0aGUgcXVldWUuXG5cdCAqIFxuXHQgKiBAcGFyYW0gIHtbdHlwZV19IG5hbWUgW2Rlc2NyaXB0aW9uXVxuXHQgKiBAcmV0dXJuIHtbdHlwZV19ICAgICAgW2Rlc2NyaXB0aW9uXVxuXHQgKi9cblx0cmVtb3ZlOiBmdW5jdGlvbihuYW1lKSB7XG5cdFx0dmFyIGFzc2V0SWR4ID0gdGhpcy5pbmRleE9mKHRoaXMuYXNzZXRzLCBuYW1lKTtcblx0XHRpZiAoYXNzZXRJZHggPT09IC0xKVxuXHRcdFx0cmV0dXJuIG51bGw7XG5cblx0XHR2YXIgYXNzZXQgPSB0aGlzLmFzc2V0c1thc3NldElkeF07XG5cdFx0dmFyIHN0YXR1cyA9IGFzc2V0LnN0YXR1cztcblxuXHRcdC8vbGV0J3Mgc2VlLi4gdGhlIGFzc2V0IGNhbiBlaXRoZXIgYmUgUVVFVUVEXG5cdFx0Ly9vciBMT0FESU5HLCBvciBMT0FERUQgKGZhaWwvc3VjY2VzcykuIGlmIGl0J3MgcXVldWVkIFxuXG5cdFx0XG5cdFx0Ly9yZW1vdmUgcmVmZXJlbmNlIHRvIHRoZSBhc3NldFxuXHRcdHRoaXMuYXNzZXRzLnNwbGljZShhc3NldElkeCwgMSk7XG5cdFx0XG5cdFx0Ly9tYWtlIHN1cmUgaXQncyBub3QgaW4gb3VyIHRhc2sgbGlzdFxuXHRcdHZhciB0YXNrSWR4ID0gdGhpcy5pbmRleE9mKHRoaXMudGFza3MsIG5hbWUpO1xuXG5cdFx0dGhpcy5fX3RvdGFsSXRlbXMgPSBNYXRoLm1heCgwLCB0aGlzLl9fdG90YWxJdGVtcy0xKTtcblx0XHR0aGlzLl9fbG9hZENvdW50ID0gTWF0aC5tYXgoMCwgdGhpcy5fX2xvYWRDb3VudC0xKTtcblx0XHRpZiAodGFza0lkeCAhPT0gLTEpIHtcblx0XHRcdC8vaXQncyB3YWl0aW5nIHRvIGJlIGxvYWRlZC4uLiB3ZSBuZWVkIHRvIHJlbW92ZSBpdFxuXHRcdFx0Ly9hbmQgYWxzbyBkZWNyZW1lbnQgdGhlIGxvYWQgLyB0b3RhbCBjb3VudFxuXHRcdFx0dGhpcy50YXNrcy5zcGxpY2UodGFza0lkeCwgMSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vbm90IGluIHRhc2tzLi4uIGFscmVhZHkgcXVldWVkXG5cdFx0XHRcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fX2xvYWRDb3VudCA9PT0gMCkge1xuXHRcdFx0aWYgKHRoaXMubG9hZGluZykge1xuXHRcdFx0XHR0aGlzLmxvYWRGaW5pc2hlZC5kaXNwYXRjaCh7XG5cdFx0XHRcdFx0Y3VycmVudDogMCxcblx0XHRcdFx0XHR0b3RhbDogMFxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdHRoaXMubG9hZGluZyA9IGZhbHNlO1xuXHRcdH1cblx0XHRyZXR1cm4gYXNzZXQudmFsdWU7XG5cdH0sXG5cblx0cmVtb3ZlQWxsOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLmFzc2V0cy5sZW5ndGggPSAwO1xuXHRcdHRoaXMudGFza3MubGVuZ3RoID0gMDtcblx0XHR0aGlzLl9fbG9hZENvdW50ID0gdGhpcy5fX3RvdGFsSXRlbXMgPSAwO1xuXG5cdFx0aWYgKHRoaXMubG9hZGluZykge1xuXHRcdFx0dGhpcy5sb2FkRmluaXNoZWQuZGlzcGF0Y2goe1xuXHRcdFx0XHRjdXJyZW50OiAwLFxuXHRcdFx0XHR0b3RhbDogMFxuXHRcdFx0fSk7XG5cdFx0fVxuXHRcdHRoaXMubG9hZGluZyA9IGZhbHNlO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBDYWxscyBgYWRkKClgIGZvciBlYWNoIHN0cmluZyBpbiB0aGUgZ2l2ZW4gYXJyYXkuXG5cdCAqXG5cdCAqIEBtZXRob2QgYWRkQWxsXG5cdCAqIEBwYXJhbSAge0FycmF5fSBhcnJheSBcblx0ICovXG5cdGFkZEFsbDogZnVuY3Rpb24oYXJyYXkpIHtcblx0XHRmb3IgKHZhciBpPTA7IGk8YXJyYXkubGVuZ3RoOyBpKyspIHtcblx0XHRcdHRoaXMuYWRkKGFycmF5W2ldKTtcblx0XHR9XG5cdH0sXG5cblx0LyoqXG5cdCAqIFB1c2hlcyBhbiBhc3NldCBvbnRvIHRoaXMgc3RhY2suIFRoaXNcblx0ICogYXR0ZW1wdHMgdG8gZGV0ZWN0IHRoZSBsb2FkZXIgZm9yIHlvdSBiYXNlZFxuXHQgKiBvbiB0aGUgYXNzZXQgbmFtZSdzIGZpbGUgZXh0ZW5zaW9uIChvciBkYXRhIFVSSSBzY2hlbWUpLiBcblx0ICogSWYgdGhlIGFzc2V0IG5hbWUgZG9lc24ndCBoYXZlIGEga25vd24gZmlsZSBleHRlbnNpb24sXG5cdCAqIG9yIGlmIHRoZXJlIGlzIG5vIGxvYWRlciByZWdpc3RlcmVkIGZvciB0aGF0IGZpbGVuYW1lLFxuXHQgKiB0aGlzIG1ldGhvZCB0aHJvd3MgYW4gZXJyb3IuIElmIHlvdSdyZSB0cnlpbmcgdG8gdXNlIFxuXHQgKiBnZW5lcmljIGtleXMgZm9yIGFzc2V0IG5hbWVzLCB1c2UgdGhlIGFkZEFzIG1ldGhvZCBhbmRcblx0ICogc3BlY2lmeSBhIGxvYWRlciBwbHVnaW4uXG5cdCAqIFxuXHQgKiBUaGlzIG1ldGhvZCdzIGFyZ3VtZW50cyBhcmUgcGFzc2VkIHRvIHRoZSBjb25zdHJ1Y3RvclxuXHQgKiBvZiB0aGUgbG9hZGVyIGZ1bmN0aW9uLiBcblx0ICpcblx0ICogVGhlIHJldHVybiB2YWx1ZSBvZiB0aGlzIG1ldGhvZCBpcyBkZXRlcm1pbmVkIGJ5XG5cdCAqIHRoZSBsb2FkZXIncyBwcm9jZXNzQXJndW1lbnRzIG1ldGhvZC4gRm9yIGV4YW1wbGUsIHRoZVxuXHQgKiBkZWZhdWx0IEltYWdlIGxvYWRlciByZXR1cm5zIGEgVGV4dHVyZSBvYmplY3QuXG5cdCAqXG5cdCAqIEBleGFtcGxlXG5cdCAqICAgIC8vdXNlcyBJbWFnZUxvYWRlciB0byBnZXQgYSBuZXcgVGV4dHVyZVxuXHQgKiAgICB2YXIgdGV4ID0gYXNzZXRzLmFkZChcInRleDAucG5nXCIpOyBcblx0ICpcblx0ICogICAgLy9vciB5b3UgY2FuIHNwZWNpZnkgeW91ciBvd24gdGV4dHVyZVxuXHQgKiAgICBhc3NldHMuYWRkKFwidGV4MS5wbmdcIiwgdGV4MSk7XG5cdCAqXG5cdCAqICAgIC8vdGhlIEltYWdlTG9hZGVyIGFsc28gYWNjZXB0cyBhIHBhdGggb3ZlcnJpZGUsIFxuXHQgKiAgICAvL2J1dCB0aGUgYXNzZXQga2V5IGlzIHN0aWxsIFwiZnJhbWVzMC5wbmdcIlxuXHQgKiAgICBhc3NldHMuYWRkKFwiZnJhbWUwLnBuZ1wiLCB0ZXgxLCBcInBhdGgvdG8vZnJhbWUxLnBuZ1wiKTtcblx0ICogICAgXG5cdCAqIEBtZXRob2QgIGFkZFxuXHQgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWUgdGhlIGFzc2V0IG5hbWVcblx0ICogQHBhcmFtICB7YW55fSBhcmdzIGEgdmFyaWFibGUgbnVtYmVyIG9mIG9wdGlvbmFsIGFyZ3VtZW50c1xuXHQgKiBAcmV0dXJuIHthbnl9IHJldHVybnMgdGhlIGJlc3QgdHlwZSBmb3IgdGhpcyBhc3NldCdzIGxvYWRlclxuXHQgKi9cblx0YWRkOiBmdW5jdGlvbihuYW1lKSB7XG5cdFx0aWYgKCFuYW1lKVxuXHRcdFx0dGhyb3cgXCJObyBhc3NldCBuYW1lIHNwZWNpZmllZCBmb3IgYWRkKClcIjtcblxuXHRcdHZhciBleHQgPSB0aGlzLl9fZ2V0RGF0YVR5cGUobmFtZSk7XG5cdFx0aWYgKGV4dCA9PT0gbnVsbClcblx0XHRcdGV4dCA9IHRoaXMuX19leHRlbnNpb24obmFtZSk7XG5cblx0XHRpZiAoIWV4dCkgXG5cdFx0XHR0aHJvdyBcIkFzc2V0IG5hbWUgZG9lcyBub3QgaGF2ZSBhIGZpbGUgZXh0ZW5zaW9uOiBcIiArIG5hbWU7XG5cdFx0aWYgKCF0aGlzLmxvYWRlcnMuaGFzT3duUHJvcGVydHkoZXh0KSlcblx0XHRcdHRocm93IFwiTm8ga25vd24gbG9hZGVyIGZvciBleHRlbnNpb24gXCIrZXh0K1wiIGluIGFzc2V0IFwiK25hbWU7XG5cblx0XHR2YXIgYXJncyA9IFsgdGhpcy5sb2FkZXJzW2V4dF0sIG5hbWUgXTtcblx0XHRhcmdzID0gYXJncy5jb25jYXQoIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSkgKTtcblxuXHRcdHJldHVybiB0aGlzLmFkZEFzLmFwcGx5KHRoaXMsIGFyZ3MpO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBQdXNoZXMgYW4gYXNzZXQgb250byB0aGlzIHN0YWNrLiBUaGlzIGFsbG93cyB5b3UgdG9cblx0ICogc3BlY2lmeSBhIGxvYWRlciBmdW5jdGlvbiBmb3IgdGhlIGFzc2V0LiBUaGlzIGlzIHVzZWZ1bFxuXHQgKiBpZiB5b3Ugd2lzaCB0byB1c2UgZ2VuZXJpYyBuYW1lcyBmb3IgeW91ciBhc3NldHMgKGluc3RlYWQgb2Zcblx0ICogZmlsZW5hbWVzKSwgb3IgaWYgeW91IHdhbnQgYSBwYXJ0aWN1bGFyIGFzc2V0IHRvIHVzZSBhIHNwZWNpZmljXG5cdCAqIGxvYWRlci4gXG5cdCAqXG5cdCAqIFRoZSBmaXJzdCBhcmd1bWVudCBpcyB0aGUgbG9hZGVyIGZ1bmN0aW9uLCBhbmQgdGhlIHNlY29uZCBpcyB0aGUgYXNzZXRcblx0ICogbmFtZS4gTGlrZSB3aXRoIHt7I2Nyb3NzTGluayBcIkFzc2V0TG9hZGVyL2xvYWQ6bWV0aG9kXCJ9fXt7L2Nyb3NzTGlua319LCBcblx0ICogYW55IHN1YnNlcXVlbnQgYXJndW1lbnRzIHdpbGwgYmUgcGFzc2VkIGFsb25nIHRvIHRoZSBsb2FkZXIuXG5cdCAqXG5cdCAqIFRoZSByZXR1cm4gdmFsdWUgb2YgdGhpcyBtZXRob2QgaXMgZGV0ZXJtaW5lZCBieVxuXHQgKiB0aGUgbG9hZGVyJ3MgcmV0dXJuIHZhbHVlLCBpZiBpdCBoYXMgb25lLiBGb3IgZXhhbXBsZSwgYSBDYW52YXMgSW1hZ2VMb2FkZXJcblx0ICogcGx1Z2luIG1pZ2h0IHJldHVybm4gSW1hZ2Ugb2JqZWN0LiBUaGlzIGlzIGFsc28gdGhlIHZhbHVlIHdoaWNoIGNhbiBiZSByZXRyaWV2ZWQgd2l0aFxuXHQgKiBgZ2V0KClgIG9yIGJ5IGFjY2Vzc2luZyB0aGUgYHZhbHVlYCBvZiBhbiBBc3NldERlc2NyaXB0b3IuIElmIHRoZSBsb2FkZXIgZnVuY3Rpb25cblx0ICogZG9lcyBub3QgaW1wbGVtZW50IGEgcmV0dXJuIHZhbHVlLCBgdW5kZWZpbmVkYCBpcyByZXR1cm5lZC4gXG5cdCAqXG5cdCAqIEBtZXRob2QgIGFkZEFzXG5cdCAqIEBwYXJhbSB7RnVjbnRpb259IGxvYWRlciB0aGUgbG9hZGVyIGZ1bmN0aW9uXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIHRoZSBhc3NldCBuYW1lXG5cdCAqIEBwYXJhbSB7T2JqZWN0IC4uLn0gYXJncyBhIHZhcmlhYmxlIG51bWJlciBvZiBvcHRpb25hbCBhcmd1bWVudHNcblx0ICogQHJldHVybiB7YW55fSByZXR1cm5zIHRoZSBiZXN0IHR5cGUgZm9yIHRoaXMgYXNzZXQncyBsb2FkZXJcblx0ICovXG5cdGFkZEFzOiBmdW5jdGlvbihsb2FkZXIsIG5hbWUpIHtcblx0XHRpZiAoIW5hbWUpXG5cdFx0XHR0aHJvdyBcIm5vIG5hbWUgc3BlY2lmaWVkIHRvIGxvYWRcIjtcblx0XHRpZiAoIWxvYWRlcilcblx0XHRcdHRocm93IFwibm8gbG9hZGVyIHNwZWNpZmllZCBmb3IgYXNzZXQgXCIrbmFtZTtcblxuXHRcdHZhciBpZHggPSB0aGlzLmluZGV4T2YodGhpcy5hc3NldHMsIG5hbWUpO1xuXHRcdGlmIChpZHggIT09IC0xKSAvL1RPRE86IGV2ZW50dWFsbHkgYWRkIHN1cHBvcnQgZm9yIGRlcGVuZGVuY2llcyBhbmQgc2hhcmVkIGFzc2V0c1xuXHRcdFx0dGhyb3cgXCJhc3NldCBhbHJlYWR5IGRlZmluZWQgaW4gYXNzZXQgbWFuYWdlclwiO1xuXG5cdFx0Ly9ncmFiIHRoZSBhcmd1bWVudHMsIGV4Y2VwdCBmb3IgdGhlIGxvYWRlciBmdW5jdGlvbi5cblx0XHR2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG5cdFx0XG5cdFx0Ly9jcmVhdGUgb3VyIGxvYWRlciBmdW5jdGlvbiBhbmQgZ2V0IHRoZSBuZXcgcmV0dXJuIHZhbHVlXG5cdFx0dmFyIHJldE9iaiA9IGxvYWRlci5hcHBseSh0aGlzLCBhcmdzKTtcblxuXHRcdGlmICh0eXBlb2YgcmV0T2JqLmxvYWQgIT09IFwiZnVuY3Rpb25cIilcblx0XHRcdHRocm93IFwibG9hZGVyIG5vdCBpbXBsZW1lbnRlZCBjb3JyZWN0bHk7IG11c3QgcmV0dXJuIGEgJ2xvYWQnIGZ1bmN0aW9uXCI7XG5cblx0XHQvL2tlZXAgaG9sZCBvZiB0aGlzIGFzc2V0IGFuZCBpdHMgb3JpZ2luYWwgbmFtZVxuXHRcdHZhciBkZXNjcmlwdG9yID0gbmV3IEFzc2V0TG9hZGVyLkRlc2NyaXB0b3IobmFtZSwgcmV0T2JqLmxvYWQsIHJldE9iai52YWx1ZSk7XG5cdFx0dGhpcy5hc3NldHMucHVzaCggZGVzY3JpcHRvciApO1xuXG5cdFx0Ly9hbHNvIGFkZCBpdCB0byBvdXIgcXVldWUgb2YgY3VycmVudCB0YXNrc1xuXHRcdHRoaXMudGFza3MucHVzaCggZGVzY3JpcHRvciApO1xuXHRcdHRoaXMuX19sb2FkQ291bnQrKztcblx0XHR0aGlzLl9fdG90YWxJdGVtcysrO1xuXG5cdFx0cmV0dXJuIHJldE9iai52YWx1ZTtcblx0fSxcblxuXHRpbmRleE9mOiBmdW5jdGlvbihsaXN0LCBuYW1lKSB7XG5cdFx0Zm9yICh2YXIgaT0wOyBpPGxpc3QubGVuZ3RoOyBpKyspIHtcblx0XHRcdGlmIChsaXN0W2ldICYmIGxpc3RbaV0ubmFtZSA9PT0gbmFtZSlcblx0XHRcdFx0cmV0dXJuIGk7XG5cdFx0fVxuXHRcdHJldHVybiAtMTtcblx0fSxcblxuXHRfX2xvYWRDYWxsYmFjazogZnVuY3Rpb24obmFtZSwgc3VjY2Vzcykge1xuXHRcdC8vaWYgJ2ZhbHNlJyB3YXMgcGFzc2VkLCB1c2UgaXQuXG5cdFx0Ly9vdGhlcndpc2UgdHJlYXQgYXMgJ3RydWUnXG5cdFx0c3VjY2VzcyA9IHN1Y2Nlc3MgIT09IGZhbHNlO1xuXG5cdFx0dmFyIGFzc2V0SWR4ID0gdGhpcy5pbmRleE9mKHRoaXMuYXNzZXRzLCBuYW1lKTtcblx0XHRcdFx0XG5cdFx0Ly9JZiB0aGUgYXNzZXQgaXMgbm90IGZvdW5kLCB3ZSBjYW4gYXNzdW1lIGl0XG5cdFx0Ly93YXMgcmVtb3ZlZCBmcm9tIHRoZSBxdWV1ZS4gaW4gdGhpcyBjYXNlIHdlIFxuXHRcdC8vd2FudCB0byBpZ25vcmUgZXZlbnRzIHNpbmNlIHRoZXkgc2hvdWxkIGFscmVhZHlcblx0XHQvL2hhdmUgYmVlbiBmaXJlZC5cblx0XHRpZiAoYXNzZXRJZHggPT09IC0xKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdFxuXHRcdHRoaXMuX19sb2FkQ291bnQtLTtcblxuXHRcdHRoaXMuYXNzZXRzW2Fzc2V0SWR4XS5zdGF0dXMgPSBzdWNjZXNzIFxuXHRcdFx0XHRcdFx0PyBBc3NldExvYWRlci5TdGF0dXMuTE9BRF9TVUNDRVNTXG5cdFx0XHRcdFx0XHQ6IEFzc2V0TG9hZGVyLlN0YXR1cy5MT0FEX0ZBSUxFRDtcblxuXHRcdHZhciBjdXJyZW50ID0gKHRoaXMuX190b3RhbEl0ZW1zIC0gdGhpcy5fX2xvYWRDb3VudCksXG5cdFx0XHR0b3RhbCA9IHRoaXMuX190b3RhbEl0ZW1zO1xuXG5cdFx0aWYgKCFzdWNjZXNzKSB7XG5cdFx0XHR0aGlzLmxvYWRFcnJvci5kaXNwYXRjaCh7XG5cdFx0XHRcdG5hbWU6IG5hbWUsXG5cdFx0XHRcdGN1cnJlbnQ6IGN1cnJlbnQsXG5cdFx0XHRcdHRvdGFsOiB0b3RhbFxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5sb2FkUHJvZ3Jlc3MuZGlzcGF0Y2goe1xuXHRcdFx0bmFtZTogbmFtZSxcblx0XHRcdGN1cnJlbnQ6IGN1cnJlbnQsXG5cdFx0XHR0b3RhbDogdG90YWxcblx0XHR9KTtcblx0XHRcdFxuXHRcdGlmICh0aGlzLl9fbG9hZENvdW50ID09PSAwKSB7XG5cdFx0XHR0aGlzLmxvYWRpbmcgPSBmYWxzZTtcblx0XHRcdHRoaXMubG9hZEZpbmlzaGVkLmRpc3BhdGNoKHtcblx0XHRcdFx0Y3VycmVudDogY3VycmVudCxcblx0XHRcdFx0dG90YWw6IHRvdGFsXG5cdFx0XHR9KTtcblx0XHR9XG5cdH0sXG5cblx0LyoqXG5cdCAqIFVwZGF0ZXMgdGhpcyBBc3NldExvYWRlciBieSBsb2FkaW5nIHRoZSBuZXh0IGFzc2V0IGluIHRoZSBxdWV1ZS5cblx0ICogSWYgYWxsIGFzc2V0cyBoYXZlIGJlZW4gbG9hZGVkLCB0aGlzIG1ldGhvZCByZXR1cm5zIHRydWUsIG90aGVyd2lzZVxuXHQgKiBpdCB3aWxsIHJldHVybiBmYWxzZS5cblx0ICpcblx0ICogQG1ldGhvZCAgdXBkYXRlXG5cdCAqIEByZXR1cm4ge0Jvb2xlYW59IHdoZXRoZXIgdGhpcyBhc3NldCBtYW5hZ2VyIGhhcyBmaW5pc2hlZCBsb2FkaW5nXG5cdCAqL1xuXHR1cGRhdGU6IGZ1bmN0aW9uKCkge1xuXHRcdGlmICh0aGlzLnRhc2tzLmxlbmd0aCA9PT0gMClcblx0XHRcdHJldHVybiAodGhpcy5fX2xvYWRDb3VudCA9PT0gMCk7XG5cblx0XHQvL0lmIHdlIHN0aWxsIGhhdmVuJ3QgcG9wcGVkIGFueSBmcm9tIHRoZSBhc3NldHMgbGlzdC4uLlxuXHRcdGlmICh0aGlzLnRhc2tzLmxlbmd0aCA9PT0gdGhpcy5hc3NldHMubGVuZ3RoKSB7XG5cdFx0XHR0aGlzLmxvYWRpbmcgPSB0cnVlO1xuXHRcdFx0dGhpcy5sb2FkU3RhcnRlZC5kaXNwYXRjaCh7XG5cdFx0XHRcdGN1cnJlbnQ6IDAsXG5cdFx0XHRcdHRvdGFsOiB0aGlzLl9fdG90YWxJdGVtc1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Ly9ncmFiIHRoZSBuZXh0IHRhc2sgb24gdGhlIHN0YWNrXG5cdFx0dmFyIG5leHRUYXNrID0gdGhpcy50YXNrcy5zaGlmdCgpO1xuXG5cdFx0Ly9hcHBseSB0aGUgbG9hZGluZyBzdGVwXG5cdFx0dmFyIGxvYWRlciA9IG5leHRUYXNrLmxvYWRGdW5jO1xuXG5cdFx0dmFyIGNiID0gdGhpcy5fX2xvYWRDYWxsYmFjay5iaW5kKHRoaXMsIG5leHRUYXNrLm5hbWUpO1xuXG5cdFx0Ly9kbyB0aGUgYXN5bmMgbG9hZCAuLi5cblx0XHRsb2FkZXIuY2FsbCh0aGlzLCBjYik7XG5cblx0XHRyZXR1cm4gKHRoaXMuX19sb2FkQ291bnQgPT09IDApO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBSZWdpc3RlcnMgYSBsb2FkZXIgZnVuY3Rpb24gZm9yIHRoaXMgcXVldWUgd2l0aCB0aGUgZ2l2ZW4gZXh0ZW5zaW9uKHMpLlxuXHQgKiBUaGlzIHdpbGwgb3ZlcnJpZGUgYW55IGV4dGVuc2lvbnMgb3IgbWltZS10eXBlcyBhbHJlYWR5IHJlZ2lzdGVyZWQuXG5cdCAqIFxuXHQgKiBAbWV0aG9kIHJlZ2lzdGVyTG9hZGVyXG5cdCAqIEBwYXJhbSB7RnVuY3Rpb259IGxvYWRlciB0aGUgbG9hZGVyIGZ1bmN0aW9uXG5cdCAqL1xuXHRyZWdpc3RlckxvYWRlcjogZnVuY3Rpb24obG9hZGVyKSB7XG5cdFx0cmVnaXN0ZXJMb2FkZXIodGhpcy5sb2FkZXJzLCBsb2FkZXIsIGxvYWRlci5leHRlbnNpb25zLCBsb2FkZXIubWVkaWFUeXBlKTtcblx0fVxufSk7XG5cdFxuLyoqXG4gKiBUaGlzIGlzIGEgbWFwIG9mIFwiY29tbW9uXCIgbG9hZGVycywgc2hhcmVkIGJ5IG1hbnkgY29udGV4dHMuXG4gKiBGb3IgZXhhbXBsZSwgYW4gaW1hZ2UgbG9hZGVyIGlzIHNwZWNpZmljIHRvIFdlYkdMLCBDYW52YXMsIFNWRywgZXRjLFxuICogYnV0IGEgSlNPTiBsb2FkZXIgbWlnaHQgYmUgcmVuZGVyZXItaW5kZXBlbmRlbnQgYW5kIHRodXMgXCJjb21tb25cIi4gXG4gKlxuICogV2hlbiBhIG5ldyBBc3NldE1hbmFnZXIgaXMgY3JlYXRlZCwgaXQgd2lsbCB1c2UgdGhlc2UgbG9hZGVycy5cbiAqIFxuICogQHR5cGUge09iamVjdH1cbiAqL1xuQXNzZXRMb2FkZXIuY29tbW9uTG9hZGVycyA9IHt9O1xuXG4vKipcbiAqIFJlZ2lzdGVycyBhIFwiY29tbW9uXCIgbG9hZGVyIGZ1bmN0aW9uIHdpdGggdGhlIGdpdmVuIGV4dGVuc2lvbihzKS5cbiAqIFxuICogRm9yIGV4YW1wbGUsIGFuIGltYWdlIGxvYWRlciBpcyBzcGVjaWZpYyB0byBXZWJHTCwgQ2FudmFzLCBTVkcsIGV0YyxcbiAqIGJ1dCBhIEpTT04gbG9hZGVyIG1pZ2h0IGJlIHJlbmRlcmVyLWluZGVwZW5kZW50IGFuZCB0aHVzIFwiY29tbW9uXCIuIFxuICpcbiAqIFdoZW4gYSBuZXcgQXNzZXRNYW5hZ2VyIGlzIGNyZWF0ZWQsIGl0IHdpbGwgdXNlIHRoZXNlIGxvYWRlcnMuXG4gKiBcbiAqIEBtZXRob2QgcmVnaXN0ZXJDb21tb25Mb2FkZXJcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGxvYWRlciB0aGUgbG9hZGVyIGZ1bmN0aW9uXG4gKi9cbkFzc2V0TG9hZGVyLnJlZ2lzdGVyQ29tbW9uTG9hZGVyID0gZnVuY3Rpb24obG9hZGVyKSB7XG5cdHJlZ2lzdGVyTG9hZGVyKEFzc2V0TG9hZGVyLmNvbW1vbkxvYWRlcnMsIGxvYWRlciwgbG9hZGVyLmV4dGVuc2lvbnMsIGxvYWRlci5tZWRpYVR5cGUpO1xufVxuXG4vKipcbiAqIEEgc2ltcGxlIHdyYXBwZXIgZm9yIGFzc2V0cyB3aGljaCB3aWxsIGJlIHBhc3NlZCBhbG9uZyB0byB0aGUgbG9hZGVyO1xuICogdGhpcyBpcyB1c2VkIGludGVybmFsbHkuXG4gKiBcbiAqIC8vQGNsYXNzIEFzc2V0TG9hZGVyLkRlc2NyaXB0b3JcbiAqL1xuQXNzZXRMb2FkZXIuRGVzY3JpcHRvciA9IGZ1bmN0aW9uKG5hbWUsIGxvYWRGdW5jLCB2YWx1ZSkge1xuXHR0aGlzLm5hbWUgPSBuYW1lO1xuXHR0aGlzLmxvYWRGdW5jID0gbG9hZEZ1bmM7XG5cdHRoaXMudmFsdWUgPSB2YWx1ZTtcblx0dGhpcy5zdGF0dXMgPSBBc3NldExvYWRlci5TdGF0dXMuUVVFVUVEO1xufTtcblxuLyoqXG4gKiBEZWZpbmVzIHRoZSBzdGF0dXMgb2YgYW4gYXNzZXQgaW4gdGhlIG1hbmFnZXIgcXVldWUuXG4gKiBUaGUgY29uc3RhbnRzIHVuZGVyIHRoaXMgb2JqZWN0IGFyZSBvbmUgb2Y6XG4gKiBcbiAqICAgICBRVUVVRURcbiAqICAgICBMT0FESU5HXG4gKiAgICAgTE9BRF9TVUNDRVNTXG4gKiAgICAgTE9BRF9GQUlMXG4gKiBcbiAqIEBhdHRyaWJ1dGUgIFN0YXR1c1xuICogQHR5cGUge09iamVjdH1cbiAqL1xuQXNzZXRMb2FkZXIuU3RhdHVzID0ge1xuXHRRVUVVRUQ6IFwiUVVFVUVEXCIsXG5cdExPQURJTkc6IFwiTE9BRElOR1wiLFxuXHRMT0FEX1NVQ0NFU1M6IFwiTE9BRF9TVUNDRVNTXCIsXG5cdExPQURfRkFJTDogXCJMT0FEX0ZBSUxcIlxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBc3NldExvYWRlcjtcbiIsIi8qanNsaW50IG9uZXZhcjp0cnVlLCB1bmRlZjp0cnVlLCBuZXdjYXA6dHJ1ZSwgcmVnZXhwOnRydWUsIGJpdHdpc2U6dHJ1ZSwgbWF4ZXJyOjUwLCBpbmRlbnQ6NCwgd2hpdGU6ZmFsc2UsIG5vbWVuOmZhbHNlLCBwbHVzcGx1czpmYWxzZSAqL1xuLypnbG9iYWwgZGVmaW5lOmZhbHNlLCByZXF1aXJlOmZhbHNlLCBleHBvcnRzOmZhbHNlLCBtb2R1bGU6ZmFsc2UsIHNpZ25hbHM6ZmFsc2UgKi9cblxuLyoqIEBsaWNlbnNlXG4gKiBKUyBTaWduYWxzIDxodHRwOi8vbWlsbGVybWVkZWlyb3MuZ2l0aHViLmNvbS9qcy1zaWduYWxzLz5cbiAqIFJlbGVhc2VkIHVuZGVyIHRoZSBNSVQgbGljZW5zZVxuICogQXV0aG9yOiBNaWxsZXIgTWVkZWlyb3NcbiAqIFZlcnNpb246IDEuMC4wIC0gQnVpbGQ6IDI2OCAoMjAxMi8xMS8yOSAwNTo0OCBQTSlcbiAqL1xuXG4oZnVuY3Rpb24oZ2xvYmFsKXtcblxuICAgIC8vIFNpZ25hbEJpbmRpbmcgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgLyoqXG4gICAgICogT2JqZWN0IHRoYXQgcmVwcmVzZW50cyBhIGJpbmRpbmcgYmV0d2VlbiBhIFNpZ25hbCBhbmQgYSBsaXN0ZW5lciBmdW5jdGlvbi5cbiAgICAgKiA8YnIgLz4tIDxzdHJvbmc+VGhpcyBpcyBhbiBpbnRlcm5hbCBjb25zdHJ1Y3RvciBhbmQgc2hvdWxkbid0IGJlIGNhbGxlZCBieSByZWd1bGFyIHVzZXJzLjwvc3Ryb25nPlxuICAgICAqIDxiciAvPi0gaW5zcGlyZWQgYnkgSm9hIEViZXJ0IEFTMyBTaWduYWxCaW5kaW5nIGFuZCBSb2JlcnQgUGVubmVyJ3MgU2xvdCBjbGFzc2VzLlxuICAgICAqIEBhdXRob3IgTWlsbGVyIE1lZGVpcm9zXG4gICAgICogQGNvbnN0cnVjdG9yXG4gICAgICogQGludGVybmFsXG4gICAgICogQG5hbWUgU2lnbmFsQmluZGluZ1xuICAgICAqIEBwYXJhbSB7U2lnbmFsfSBzaWduYWwgUmVmZXJlbmNlIHRvIFNpZ25hbCBvYmplY3QgdGhhdCBsaXN0ZW5lciBpcyBjdXJyZW50bHkgYm91bmQgdG8uXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXIgSGFuZGxlciBmdW5jdGlvbiBib3VuZCB0byB0aGUgc2lnbmFsLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNPbmNlIElmIGJpbmRpbmcgc2hvdWxkIGJlIGV4ZWN1dGVkIGp1c3Qgb25jZS5cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2xpc3RlbmVyQ29udGV4dF0gQ29udGV4dCBvbiB3aGljaCBsaXN0ZW5lciB3aWxsIGJlIGV4ZWN1dGVkIChvYmplY3QgdGhhdCBzaG91bGQgcmVwcmVzZW50IHRoZSBgdGhpc2AgdmFyaWFibGUgaW5zaWRlIGxpc3RlbmVyIGZ1bmN0aW9uKS5cbiAgICAgKiBAcGFyYW0ge051bWJlcn0gW3ByaW9yaXR5XSBUaGUgcHJpb3JpdHkgbGV2ZWwgb2YgdGhlIGV2ZW50IGxpc3RlbmVyLiAoZGVmYXVsdCA9IDApLlxuICAgICAqL1xuICAgIGZ1bmN0aW9uIFNpZ25hbEJpbmRpbmcoc2lnbmFsLCBsaXN0ZW5lciwgaXNPbmNlLCBsaXN0ZW5lckNvbnRleHQsIHByaW9yaXR5KSB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEhhbmRsZXIgZnVuY3Rpb24gYm91bmQgdG8gdGhlIHNpZ25hbC5cbiAgICAgICAgICogQHR5cGUgRnVuY3Rpb25cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2xpc3RlbmVyID0gbGlzdGVuZXI7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIElmIGJpbmRpbmcgc2hvdWxkIGJlIGV4ZWN1dGVkIGp1c3Qgb25jZS5cbiAgICAgICAgICogQHR5cGUgYm9vbGVhblxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5faXNPbmNlID0gaXNPbmNlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDb250ZXh0IG9uIHdoaWNoIGxpc3RlbmVyIHdpbGwgYmUgZXhlY3V0ZWQgKG9iamVjdCB0aGF0IHNob3VsZCByZXByZXNlbnQgdGhlIGB0aGlzYCB2YXJpYWJsZSBpbnNpZGUgbGlzdGVuZXIgZnVuY3Rpb24pLlxuICAgICAgICAgKiBAbWVtYmVyT2YgU2lnbmFsQmluZGluZy5wcm90b3R5cGVcbiAgICAgICAgICogQG5hbWUgY29udGV4dFxuICAgICAgICAgKiBAdHlwZSBPYmplY3R8dW5kZWZpbmVkfG51bGxcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuY29udGV4dCA9IGxpc3RlbmVyQ29udGV4dDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVmZXJlbmNlIHRvIFNpZ25hbCBvYmplY3QgdGhhdCBsaXN0ZW5lciBpcyBjdXJyZW50bHkgYm91bmQgdG8uXG4gICAgICAgICAqIEB0eXBlIFNpZ25hbFxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fc2lnbmFsID0gc2lnbmFsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBMaXN0ZW5lciBwcmlvcml0eVxuICAgICAgICAgKiBAdHlwZSBOdW1iZXJcbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3ByaW9yaXR5ID0gcHJpb3JpdHkgfHwgMDtcbiAgICB9XG5cbiAgICBTaWduYWxCaW5kaW5nLnByb3RvdHlwZSA9IHtcblxuICAgICAgICAvKipcbiAgICAgICAgICogSWYgYmluZGluZyBpcyBhY3RpdmUgYW5kIHNob3VsZCBiZSBleGVjdXRlZC5cbiAgICAgICAgICogQHR5cGUgYm9vbGVhblxuICAgICAgICAgKi9cbiAgICAgICAgYWN0aXZlIDogdHJ1ZSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogRGVmYXVsdCBwYXJhbWV0ZXJzIHBhc3NlZCB0byBsaXN0ZW5lciBkdXJpbmcgYFNpZ25hbC5kaXNwYXRjaGAgYW5kIGBTaWduYWxCaW5kaW5nLmV4ZWN1dGVgLiAoY3VycmllZCBwYXJhbWV0ZXJzKVxuICAgICAgICAgKiBAdHlwZSBBcnJheXxudWxsXG4gICAgICAgICAqL1xuICAgICAgICBwYXJhbXMgOiBudWxsLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDYWxsIGxpc3RlbmVyIHBhc3NpbmcgYXJiaXRyYXJ5IHBhcmFtZXRlcnMuXG4gICAgICAgICAqIDxwPklmIGJpbmRpbmcgd2FzIGFkZGVkIHVzaW5nIGBTaWduYWwuYWRkT25jZSgpYCBpdCB3aWxsIGJlIGF1dG9tYXRpY2FsbHkgcmVtb3ZlZCBmcm9tIHNpZ25hbCBkaXNwYXRjaCBxdWV1ZSwgdGhpcyBtZXRob2QgaXMgdXNlZCBpbnRlcm5hbGx5IGZvciB0aGUgc2lnbmFsIGRpc3BhdGNoLjwvcD5cbiAgICAgICAgICogQHBhcmFtIHtBcnJheX0gW3BhcmFtc0Fycl0gQXJyYXkgb2YgcGFyYW1ldGVycyB0aGF0IHNob3VsZCBiZSBwYXNzZWQgdG8gdGhlIGxpc3RlbmVyXG4gICAgICAgICAqIEByZXR1cm4geyp9IFZhbHVlIHJldHVybmVkIGJ5IHRoZSBsaXN0ZW5lci5cbiAgICAgICAgICovXG4gICAgICAgIGV4ZWN1dGUgOiBmdW5jdGlvbiAocGFyYW1zQXJyKSB7XG4gICAgICAgICAgICB2YXIgaGFuZGxlclJldHVybiwgcGFyYW1zO1xuICAgICAgICAgICAgaWYgKHRoaXMuYWN0aXZlICYmICEhdGhpcy5fbGlzdGVuZXIpIHtcbiAgICAgICAgICAgICAgICBwYXJhbXMgPSB0aGlzLnBhcmFtcz8gdGhpcy5wYXJhbXMuY29uY2F0KHBhcmFtc0FycikgOiBwYXJhbXNBcnI7XG4gICAgICAgICAgICAgICAgaGFuZGxlclJldHVybiA9IHRoaXMuX2xpc3RlbmVyLmFwcGx5KHRoaXMuY29udGV4dCwgcGFyYW1zKTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5faXNPbmNlKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZGV0YWNoKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGhhbmRsZXJSZXR1cm47XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIERldGFjaCBiaW5kaW5nIGZyb20gc2lnbmFsLlxuICAgICAgICAgKiAtIGFsaWFzIHRvOiBteVNpZ25hbC5yZW1vdmUobXlCaW5kaW5nLmdldExpc3RlbmVyKCkpO1xuICAgICAgICAgKiBAcmV0dXJuIHtGdW5jdGlvbnxudWxsfSBIYW5kbGVyIGZ1bmN0aW9uIGJvdW5kIHRvIHRoZSBzaWduYWwgb3IgYG51bGxgIGlmIGJpbmRpbmcgd2FzIHByZXZpb3VzbHkgZGV0YWNoZWQuXG4gICAgICAgICAqL1xuICAgICAgICBkZXRhY2ggOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5pc0JvdW5kKCk/IHRoaXMuX3NpZ25hbC5yZW1vdmUodGhpcy5fbGlzdGVuZXIsIHRoaXMuY29udGV4dCkgOiBudWxsO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAcmV0dXJuIHtCb29sZWFufSBgdHJ1ZWAgaWYgYmluZGluZyBpcyBzdGlsbCBib3VuZCB0byB0aGUgc2lnbmFsIGFuZCBoYXZlIGEgbGlzdGVuZXIuXG4gICAgICAgICAqL1xuICAgICAgICBpc0JvdW5kIDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuICghIXRoaXMuX3NpZ25hbCAmJiAhIXRoaXMuX2xpc3RlbmVyKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHJldHVybiB7Ym9vbGVhbn0gSWYgU2lnbmFsQmluZGluZyB3aWxsIG9ubHkgYmUgZXhlY3V0ZWQgb25jZS5cbiAgICAgICAgICovXG4gICAgICAgIGlzT25jZSA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9pc09uY2U7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEByZXR1cm4ge0Z1bmN0aW9ufSBIYW5kbGVyIGZ1bmN0aW9uIGJvdW5kIHRvIHRoZSBzaWduYWwuXG4gICAgICAgICAqL1xuICAgICAgICBnZXRMaXN0ZW5lciA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9saXN0ZW5lcjtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHJldHVybiB7U2lnbmFsfSBTaWduYWwgdGhhdCBsaXN0ZW5lciBpcyBjdXJyZW50bHkgYm91bmQgdG8uXG4gICAgICAgICAqL1xuICAgICAgICBnZXRTaWduYWwgOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fc2lnbmFsO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBEZWxldGUgaW5zdGFuY2UgcHJvcGVydGllc1xuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgX2Rlc3Ryb3kgOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fc2lnbmFsO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2xpc3RlbmVyO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuY29udGV4dDtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHJldHVybiB7c3RyaW5nfSBTdHJpbmcgcmVwcmVzZW50YXRpb24gb2YgdGhlIG9iamVjdC5cbiAgICAgICAgICovXG4gICAgICAgIHRvU3RyaW5nIDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuICdbU2lnbmFsQmluZGluZyBpc09uY2U6JyArIHRoaXMuX2lzT25jZSArJywgaXNCb3VuZDonKyB0aGlzLmlzQm91bmQoKSArJywgYWN0aXZlOicgKyB0aGlzLmFjdGl2ZSArICddJztcbiAgICAgICAgfVxuXG4gICAgfTtcblxuXG4vKmdsb2JhbCBTaWduYWxCaW5kaW5nOmZhbHNlKi9cblxuICAgIC8vIFNpZ25hbCAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgZnVuY3Rpb24gdmFsaWRhdGVMaXN0ZW5lcihsaXN0ZW5lciwgZm5OYW1lKSB7XG4gICAgICAgIGlmICh0eXBlb2YgbGlzdGVuZXIgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvciggJ2xpc3RlbmVyIGlzIGEgcmVxdWlyZWQgcGFyYW0gb2Yge2ZufSgpIGFuZCBzaG91bGQgYmUgYSBGdW5jdGlvbi4nLnJlcGxhY2UoJ3tmbn0nLCBmbk5hbWUpICk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDdXN0b20gZXZlbnQgYnJvYWRjYXN0ZXJcbiAgICAgKiA8YnIgLz4tIGluc3BpcmVkIGJ5IFJvYmVydCBQZW5uZXIncyBBUzMgU2lnbmFscy5cbiAgICAgKiBAbmFtZSBTaWduYWxcbiAgICAgKiBAYXV0aG9yIE1pbGxlciBNZWRlaXJvc1xuICAgICAqIEBjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGZ1bmN0aW9uIFNpZ25hbCgpIHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIEFycmF5LjxTaWduYWxCaW5kaW5nPlxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fYmluZGluZ3MgPSBbXTtcbiAgICAgICAgdGhpcy5fcHJldlBhcmFtcyA9IG51bGw7XG5cbiAgICAgICAgLy8gZW5mb3JjZSBkaXNwYXRjaCB0byBhd2F5cyB3b3JrIG9uIHNhbWUgY29udGV4dCAoIzQ3KVxuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHRoaXMuZGlzcGF0Y2ggPSBmdW5jdGlvbigpe1xuICAgICAgICAgICAgU2lnbmFsLnByb3RvdHlwZS5kaXNwYXRjaC5hcHBseShzZWxmLCBhcmd1bWVudHMpO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIFNpZ25hbC5wcm90b3R5cGUgPSB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNpZ25hbHMgVmVyc2lvbiBOdW1iZXJcbiAgICAgICAgICogQHR5cGUgU3RyaW5nXG4gICAgICAgICAqIEBjb25zdFxuICAgICAgICAgKi9cbiAgICAgICAgVkVSU0lPTiA6ICcxLjAuMCcsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIElmIFNpZ25hbCBzaG91bGQga2VlcCByZWNvcmQgb2YgcHJldmlvdXNseSBkaXNwYXRjaGVkIHBhcmFtZXRlcnMgYW5kXG4gICAgICAgICAqIGF1dG9tYXRpY2FsbHkgZXhlY3V0ZSBsaXN0ZW5lciBkdXJpbmcgYGFkZCgpYC9gYWRkT25jZSgpYCBpZiBTaWduYWwgd2FzXG4gICAgICAgICAqIGFscmVhZHkgZGlzcGF0Y2hlZCBiZWZvcmUuXG4gICAgICAgICAqIEB0eXBlIGJvb2xlYW5cbiAgICAgICAgICovXG4gICAgICAgIG1lbW9yaXplIDogZmFsc2UsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIGJvb2xlYW5cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIF9zaG91bGRQcm9wYWdhdGUgOiB0cnVlLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBJZiBTaWduYWwgaXMgYWN0aXZlIGFuZCBzaG91bGQgYnJvYWRjYXN0IGV2ZW50cy5cbiAgICAgICAgICogPHA+PHN0cm9uZz5JTVBPUlRBTlQ6PC9zdHJvbmc+IFNldHRpbmcgdGhpcyBwcm9wZXJ0eSBkdXJpbmcgYSBkaXNwYXRjaCB3aWxsIG9ubHkgYWZmZWN0IHRoZSBuZXh0IGRpc3BhdGNoLCBpZiB5b3Ugd2FudCB0byBzdG9wIHRoZSBwcm9wYWdhdGlvbiBvZiBhIHNpZ25hbCB1c2UgYGhhbHQoKWAgaW5zdGVhZC48L3A+XG4gICAgICAgICAqIEB0eXBlIGJvb2xlYW5cbiAgICAgICAgICovXG4gICAgICAgIGFjdGl2ZSA6IHRydWUsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyXG4gICAgICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNPbmNlXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbbGlzdGVuZXJDb250ZXh0XVxuICAgICAgICAgKiBAcGFyYW0ge051bWJlcn0gW3ByaW9yaXR5XVxuICAgICAgICAgKiBAcmV0dXJuIHtTaWduYWxCaW5kaW5nfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgX3JlZ2lzdGVyTGlzdGVuZXIgOiBmdW5jdGlvbiAobGlzdGVuZXIsIGlzT25jZSwgbGlzdGVuZXJDb250ZXh0LCBwcmlvcml0eSkge1xuXG4gICAgICAgICAgICB2YXIgcHJldkluZGV4ID0gdGhpcy5faW5kZXhPZkxpc3RlbmVyKGxpc3RlbmVyLCBsaXN0ZW5lckNvbnRleHQpLFxuICAgICAgICAgICAgICAgIGJpbmRpbmc7XG5cbiAgICAgICAgICAgIGlmIChwcmV2SW5kZXggIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgYmluZGluZyA9IHRoaXMuX2JpbmRpbmdzW3ByZXZJbmRleF07XG4gICAgICAgICAgICAgICAgaWYgKGJpbmRpbmcuaXNPbmNlKCkgIT09IGlzT25jZSkge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1lvdSBjYW5ub3QgYWRkJysgKGlzT25jZT8gJycgOiAnT25jZScpICsnKCkgdGhlbiBhZGQnKyAoIWlzT25jZT8gJycgOiAnT25jZScpICsnKCkgdGhlIHNhbWUgbGlzdGVuZXIgd2l0aG91dCByZW1vdmluZyB0aGUgcmVsYXRpb25zaGlwIGZpcnN0LicpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYmluZGluZyA9IG5ldyBTaWduYWxCaW5kaW5nKHRoaXMsIGxpc3RlbmVyLCBpc09uY2UsIGxpc3RlbmVyQ29udGV4dCwgcHJpb3JpdHkpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2FkZEJpbmRpbmcoYmluZGluZyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmKHRoaXMubWVtb3JpemUgJiYgdGhpcy5fcHJldlBhcmFtcyl7XG4gICAgICAgICAgICAgICAgYmluZGluZy5leGVjdXRlKHRoaXMuX3ByZXZQYXJhbXMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gYmluZGluZztcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHBhcmFtIHtTaWduYWxCaW5kaW5nfSBiaW5kaW5nXG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICBfYWRkQmluZGluZyA6IGZ1bmN0aW9uIChiaW5kaW5nKSB7XG4gICAgICAgICAgICAvL3NpbXBsaWZpZWQgaW5zZXJ0aW9uIHNvcnRcbiAgICAgICAgICAgIHZhciBuID0gdGhpcy5fYmluZGluZ3MubGVuZ3RoO1xuICAgICAgICAgICAgZG8geyAtLW47IH0gd2hpbGUgKHRoaXMuX2JpbmRpbmdzW25dICYmIGJpbmRpbmcuX3ByaW9yaXR5IDw9IHRoaXMuX2JpbmRpbmdzW25dLl9wcmlvcml0eSk7XG4gICAgICAgICAgICB0aGlzLl9iaW5kaW5ncy5zcGxpY2UobiArIDEsIDAsIGJpbmRpbmcpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lclxuICAgICAgICAgKiBAcmV0dXJuIHtudW1iZXJ9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICBfaW5kZXhPZkxpc3RlbmVyIDogZnVuY3Rpb24gKGxpc3RlbmVyLCBjb250ZXh0KSB7XG4gICAgICAgICAgICB2YXIgbiA9IHRoaXMuX2JpbmRpbmdzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICBjdXI7XG4gICAgICAgICAgICB3aGlsZSAobi0tKSB7XG4gICAgICAgICAgICAgICAgY3VyID0gdGhpcy5fYmluZGluZ3Nbbl07XG4gICAgICAgICAgICAgICAgaWYgKGN1ci5fbGlzdGVuZXIgPT09IGxpc3RlbmVyICYmIGN1ci5jb250ZXh0ID09PSBjb250ZXh0KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQ2hlY2sgaWYgbGlzdGVuZXIgd2FzIGF0dGFjaGVkIHRvIFNpZ25hbC5cbiAgICAgICAgICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXJcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IFtjb250ZXh0XVxuICAgICAgICAgKiBAcmV0dXJuIHtib29sZWFufSBpZiBTaWduYWwgaGFzIHRoZSBzcGVjaWZpZWQgbGlzdGVuZXIuXG4gICAgICAgICAqL1xuICAgICAgICBoYXMgOiBmdW5jdGlvbiAobGlzdGVuZXIsIGNvbnRleHQpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9pbmRleE9mTGlzdGVuZXIobGlzdGVuZXIsIGNvbnRleHQpICE9PSAtMTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQWRkIGEgbGlzdGVuZXIgdG8gdGhlIHNpZ25hbC5cbiAgICAgICAgICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXIgU2lnbmFsIGhhbmRsZXIgZnVuY3Rpb24uXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbbGlzdGVuZXJDb250ZXh0XSBDb250ZXh0IG9uIHdoaWNoIGxpc3RlbmVyIHdpbGwgYmUgZXhlY3V0ZWQgKG9iamVjdCB0aGF0IHNob3VsZCByZXByZXNlbnQgdGhlIGB0aGlzYCB2YXJpYWJsZSBpbnNpZGUgbGlzdGVuZXIgZnVuY3Rpb24pLlxuICAgICAgICAgKiBAcGFyYW0ge051bWJlcn0gW3ByaW9yaXR5XSBUaGUgcHJpb3JpdHkgbGV2ZWwgb2YgdGhlIGV2ZW50IGxpc3RlbmVyLiBMaXN0ZW5lcnMgd2l0aCBoaWdoZXIgcHJpb3JpdHkgd2lsbCBiZSBleGVjdXRlZCBiZWZvcmUgbGlzdGVuZXJzIHdpdGggbG93ZXIgcHJpb3JpdHkuIExpc3RlbmVycyB3aXRoIHNhbWUgcHJpb3JpdHkgbGV2ZWwgd2lsbCBiZSBleGVjdXRlZCBhdCB0aGUgc2FtZSBvcmRlciBhcyB0aGV5IHdlcmUgYWRkZWQuIChkZWZhdWx0ID0gMClcbiAgICAgICAgICogQHJldHVybiB7U2lnbmFsQmluZGluZ30gQW4gT2JqZWN0IHJlcHJlc2VudGluZyB0aGUgYmluZGluZyBiZXR3ZWVuIHRoZSBTaWduYWwgYW5kIGxpc3RlbmVyLlxuICAgICAgICAgKi9cbiAgICAgICAgYWRkIDogZnVuY3Rpb24gKGxpc3RlbmVyLCBsaXN0ZW5lckNvbnRleHQsIHByaW9yaXR5KSB7XG4gICAgICAgICAgICB2YWxpZGF0ZUxpc3RlbmVyKGxpc3RlbmVyLCAnYWRkJyk7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fcmVnaXN0ZXJMaXN0ZW5lcihsaXN0ZW5lciwgZmFsc2UsIGxpc3RlbmVyQ29udGV4dCwgcHJpb3JpdHkpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBZGQgbGlzdGVuZXIgdG8gdGhlIHNpZ25hbCB0aGF0IHNob3VsZCBiZSByZW1vdmVkIGFmdGVyIGZpcnN0IGV4ZWN1dGlvbiAod2lsbCBiZSBleGVjdXRlZCBvbmx5IG9uY2UpLlxuICAgICAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lciBTaWduYWwgaGFuZGxlciBmdW5jdGlvbi5cbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IFtsaXN0ZW5lckNvbnRleHRdIENvbnRleHQgb24gd2hpY2ggbGlzdGVuZXIgd2lsbCBiZSBleGVjdXRlZCAob2JqZWN0IHRoYXQgc2hvdWxkIHJlcHJlc2VudCB0aGUgYHRoaXNgIHZhcmlhYmxlIGluc2lkZSBsaXN0ZW5lciBmdW5jdGlvbikuXG4gICAgICAgICAqIEBwYXJhbSB7TnVtYmVyfSBbcHJpb3JpdHldIFRoZSBwcmlvcml0eSBsZXZlbCBvZiB0aGUgZXZlbnQgbGlzdGVuZXIuIExpc3RlbmVycyB3aXRoIGhpZ2hlciBwcmlvcml0eSB3aWxsIGJlIGV4ZWN1dGVkIGJlZm9yZSBsaXN0ZW5lcnMgd2l0aCBsb3dlciBwcmlvcml0eS4gTGlzdGVuZXJzIHdpdGggc2FtZSBwcmlvcml0eSBsZXZlbCB3aWxsIGJlIGV4ZWN1dGVkIGF0IHRoZSBzYW1lIG9yZGVyIGFzIHRoZXkgd2VyZSBhZGRlZC4gKGRlZmF1bHQgPSAwKVxuICAgICAgICAgKiBAcmV0dXJuIHtTaWduYWxCaW5kaW5nfSBBbiBPYmplY3QgcmVwcmVzZW50aW5nIHRoZSBiaW5kaW5nIGJldHdlZW4gdGhlIFNpZ25hbCBhbmQgbGlzdGVuZXIuXG4gICAgICAgICAqL1xuICAgICAgICBhZGRPbmNlIDogZnVuY3Rpb24gKGxpc3RlbmVyLCBsaXN0ZW5lckNvbnRleHQsIHByaW9yaXR5KSB7XG4gICAgICAgICAgICB2YWxpZGF0ZUxpc3RlbmVyKGxpc3RlbmVyLCAnYWRkT25jZScpO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3JlZ2lzdGVyTGlzdGVuZXIobGlzdGVuZXIsIHRydWUsIGxpc3RlbmVyQ29udGV4dCwgcHJpb3JpdHkpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZW1vdmUgYSBzaW5nbGUgbGlzdGVuZXIgZnJvbSB0aGUgZGlzcGF0Y2ggcXVldWUuXG4gICAgICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyIEhhbmRsZXIgZnVuY3Rpb24gdGhhdCBzaG91bGQgYmUgcmVtb3ZlZC5cbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IFtjb250ZXh0XSBFeGVjdXRpb24gY29udGV4dCAoc2luY2UgeW91IGNhbiBhZGQgdGhlIHNhbWUgaGFuZGxlciBtdWx0aXBsZSB0aW1lcyBpZiBleGVjdXRpbmcgaW4gYSBkaWZmZXJlbnQgY29udGV4dCkuXG4gICAgICAgICAqIEByZXR1cm4ge0Z1bmN0aW9ufSBMaXN0ZW5lciBoYW5kbGVyIGZ1bmN0aW9uLlxuICAgICAgICAgKi9cbiAgICAgICAgcmVtb3ZlIDogZnVuY3Rpb24gKGxpc3RlbmVyLCBjb250ZXh0KSB7XG4gICAgICAgICAgICB2YWxpZGF0ZUxpc3RlbmVyKGxpc3RlbmVyLCAncmVtb3ZlJyk7XG5cbiAgICAgICAgICAgIHZhciBpID0gdGhpcy5faW5kZXhPZkxpc3RlbmVyKGxpc3RlbmVyLCBjb250ZXh0KTtcbiAgICAgICAgICAgIGlmIChpICE9PSAtMSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRpbmdzW2ldLl9kZXN0cm95KCk7IC8vbm8gcmVhc29uIHRvIGEgU2lnbmFsQmluZGluZyBleGlzdCBpZiBpdCBpc24ndCBhdHRhY2hlZCB0byBhIHNpZ25hbFxuICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRpbmdzLnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBsaXN0ZW5lcjtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVtb3ZlIGFsbCBsaXN0ZW5lcnMgZnJvbSB0aGUgU2lnbmFsLlxuICAgICAgICAgKi9cbiAgICAgICAgcmVtb3ZlQWxsIDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIG4gPSB0aGlzLl9iaW5kaW5ncy5sZW5ndGg7XG4gICAgICAgICAgICB3aGlsZSAobi0tKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYmluZGluZ3Nbbl0uX2Rlc3Ryb3koKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuX2JpbmRpbmdzLmxlbmd0aCA9IDA7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEByZXR1cm4ge251bWJlcn0gTnVtYmVyIG9mIGxpc3RlbmVycyBhdHRhY2hlZCB0byB0aGUgU2lnbmFsLlxuICAgICAgICAgKi9cbiAgICAgICAgZ2V0TnVtTGlzdGVuZXJzIDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2JpbmRpbmdzLmxlbmd0aDtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogU3RvcCBwcm9wYWdhdGlvbiBvZiB0aGUgZXZlbnQsIGJsb2NraW5nIHRoZSBkaXNwYXRjaCB0byBuZXh0IGxpc3RlbmVycyBvbiB0aGUgcXVldWUuXG4gICAgICAgICAqIDxwPjxzdHJvbmc+SU1QT1JUQU5UOjwvc3Ryb25nPiBzaG91bGQgYmUgY2FsbGVkIG9ubHkgZHVyaW5nIHNpZ25hbCBkaXNwYXRjaCwgY2FsbGluZyBpdCBiZWZvcmUvYWZ0ZXIgZGlzcGF0Y2ggd29uJ3QgYWZmZWN0IHNpZ25hbCBicm9hZGNhc3QuPC9wPlxuICAgICAgICAgKiBAc2VlIFNpZ25hbC5wcm90b3R5cGUuZGlzYWJsZVxuICAgICAgICAgKi9cbiAgICAgICAgaGFsdCA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHRoaXMuX3Nob3VsZFByb3BhZ2F0ZSA9IGZhbHNlO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBEaXNwYXRjaC9Ccm9hZGNhc3QgU2lnbmFsIHRvIGFsbCBsaXN0ZW5lcnMgYWRkZWQgdG8gdGhlIHF1ZXVlLlxuICAgICAgICAgKiBAcGFyYW0gey4uLip9IFtwYXJhbXNdIFBhcmFtZXRlcnMgdGhhdCBzaG91bGQgYmUgcGFzc2VkIHRvIGVhY2ggaGFuZGxlci5cbiAgICAgICAgICovXG4gICAgICAgIGRpc3BhdGNoIDogZnVuY3Rpb24gKHBhcmFtcykge1xuICAgICAgICAgICAgaWYgKCEgdGhpcy5hY3RpdmUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBwYXJhbXNBcnIgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpLFxuICAgICAgICAgICAgICAgIG4gPSB0aGlzLl9iaW5kaW5ncy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgYmluZGluZ3M7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLm1lbW9yaXplKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcHJldlBhcmFtcyA9IHBhcmFtc0FycjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCEgbikge1xuICAgICAgICAgICAgICAgIC8vc2hvdWxkIGNvbWUgYWZ0ZXIgbWVtb3JpemVcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGJpbmRpbmdzID0gdGhpcy5fYmluZGluZ3Muc2xpY2UoKTsgLy9jbG9uZSBhcnJheSBpbiBjYXNlIGFkZC9yZW1vdmUgaXRlbXMgZHVyaW5nIGRpc3BhdGNoXG4gICAgICAgICAgICB0aGlzLl9zaG91bGRQcm9wYWdhdGUgPSB0cnVlOyAvL2luIGNhc2UgYGhhbHRgIHdhcyBjYWxsZWQgYmVmb3JlIGRpc3BhdGNoIG9yIGR1cmluZyB0aGUgcHJldmlvdXMgZGlzcGF0Y2guXG5cbiAgICAgICAgICAgIC8vZXhlY3V0ZSBhbGwgY2FsbGJhY2tzIHVudGlsIGVuZCBvZiB0aGUgbGlzdCBvciB1bnRpbCBhIGNhbGxiYWNrIHJldHVybnMgYGZhbHNlYCBvciBzdG9wcyBwcm9wYWdhdGlvblxuICAgICAgICAgICAgLy9yZXZlcnNlIGxvb3Agc2luY2UgbGlzdGVuZXJzIHdpdGggaGlnaGVyIHByaW9yaXR5IHdpbGwgYmUgYWRkZWQgYXQgdGhlIGVuZCBvZiB0aGUgbGlzdFxuICAgICAgICAgICAgZG8geyBuLS07IH0gd2hpbGUgKGJpbmRpbmdzW25dICYmIHRoaXMuX3Nob3VsZFByb3BhZ2F0ZSAmJiBiaW5kaW5nc1tuXS5leGVjdXRlKHBhcmFtc0FycikgIT09IGZhbHNlKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogRm9yZ2V0IG1lbW9yaXplZCBhcmd1bWVudHMuXG4gICAgICAgICAqIEBzZWUgU2lnbmFsLm1lbW9yaXplXG4gICAgICAgICAqL1xuICAgICAgICBmb3JnZXQgOiBmdW5jdGlvbigpe1xuICAgICAgICAgICAgdGhpcy5fcHJldlBhcmFtcyA9IG51bGw7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJlbW92ZSBhbGwgYmluZGluZ3MgZnJvbSBzaWduYWwgYW5kIGRlc3Ryb3kgYW55IHJlZmVyZW5jZSB0byBleHRlcm5hbCBvYmplY3RzIChkZXN0cm95IFNpZ25hbCBvYmplY3QpLlxuICAgICAgICAgKiA8cD48c3Ryb25nPklNUE9SVEFOVDo8L3N0cm9uZz4gY2FsbGluZyBhbnkgbWV0aG9kIG9uIHRoZSBzaWduYWwgaW5zdGFuY2UgYWZ0ZXIgY2FsbGluZyBkaXNwb3NlIHdpbGwgdGhyb3cgZXJyb3JzLjwvcD5cbiAgICAgICAgICovXG4gICAgICAgIGRpc3Bvc2UgOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aGlzLnJlbW92ZUFsbCgpO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2JpbmRpbmdzO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX3ByZXZQYXJhbXM7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEByZXR1cm4ge3N0cmluZ30gU3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBvYmplY3QuXG4gICAgICAgICAqL1xuICAgICAgICB0b1N0cmluZyA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiAnW1NpZ25hbCBhY3RpdmU6JysgdGhpcy5hY3RpdmUgKycgbnVtTGlzdGVuZXJzOicrIHRoaXMuZ2V0TnVtTGlzdGVuZXJzKCkgKyddJztcbiAgICAgICAgfVxuXG4gICAgfTtcblxuXG4gICAgLy8gTmFtZXNwYWNlIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy89PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAvKipcbiAgICAgKiBTaWduYWxzIG5hbWVzcGFjZVxuICAgICAqIEBuYW1lc3BhY2VcbiAgICAgKiBAbmFtZSBzaWduYWxzXG4gICAgICovXG4gICAgdmFyIHNpZ25hbHMgPSBTaWduYWw7XG5cbiAgICAvKipcbiAgICAgKiBDdXN0b20gZXZlbnQgYnJvYWRjYXN0ZXJcbiAgICAgKiBAc2VlIFNpZ25hbFxuICAgICAqL1xuICAgIC8vIGFsaWFzIGZvciBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eSAoc2VlICNnaC00NClcbiAgICBzaWduYWxzLlNpZ25hbCA9IFNpZ25hbDtcblxuXG5cbiAgICAvL2V4cG9ydHMgdG8gbXVsdGlwbGUgZW52aXJvbm1lbnRzXG4gICAgaWYodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKXsgLy9BTURcbiAgICAgICAgZGVmaW5lKGZ1bmN0aW9uICgpIHsgcmV0dXJuIHNpZ25hbHM7IH0pO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMpeyAvL25vZGVcbiAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSBzaWduYWxzO1xuICAgIH0gZWxzZSB7IC8vYnJvd3NlclxuICAgICAgICAvL3VzZSBzdHJpbmcgYmVjYXVzZSBvZiBHb29nbGUgY2xvc3VyZSBjb21waWxlciBBRFZBTkNFRF9NT0RFXG4gICAgICAgIC8qanNsaW50IHN1Yjp0cnVlICovXG4gICAgICAgIGdsb2JhbFsnc2lnbmFscyddID0gc2lnbmFscztcbiAgICB9XG5cbn0odGhpcykpO1xuIiwiZnVuY3Rpb24gaGFzR2V0dGVyT3JTZXR0ZXIoZGVmKSB7XG5cdHJldHVybiAoISFkZWYuZ2V0ICYmIHR5cGVvZiBkZWYuZ2V0ID09PSBcImZ1bmN0aW9uXCIpIHx8ICghIWRlZi5zZXQgJiYgdHlwZW9mIGRlZi5zZXQgPT09IFwiZnVuY3Rpb25cIik7XG59XG5cbmZ1bmN0aW9uIGdldFByb3BlcnR5KGRlZmluaXRpb24sIGssIGlzQ2xhc3NEZXNjcmlwdG9yKSB7XG5cdC8vVGhpcyBtYXkgYmUgYSBsaWdodHdlaWdodCBvYmplY3QsIE9SIGl0IG1pZ2h0IGJlIGEgcHJvcGVydHlcblx0Ly90aGF0IHdhcyBkZWZpbmVkIHByZXZpb3VzbHkuXG5cdFxuXHQvL0ZvciBzaW1wbGUgY2xhc3MgZGVzY3JpcHRvcnMgd2UgY2FuIGp1c3QgYXNzdW1lIGl0cyBOT1QgcHJldmlvdXNseSBkZWZpbmVkLlxuXHR2YXIgZGVmID0gaXNDbGFzc0Rlc2NyaXB0b3IgXG5cdFx0XHRcdD8gZGVmaW5pdGlvbltrXSBcblx0XHRcdFx0OiBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKGRlZmluaXRpb24sIGspO1xuXG5cdGlmICghaXNDbGFzc0Rlc2NyaXB0b3IgJiYgZGVmLnZhbHVlICYmIHR5cGVvZiBkZWYudmFsdWUgPT09IFwib2JqZWN0XCIpIHtcblx0XHRkZWYgPSBkZWYudmFsdWU7XG5cdH1cblxuXG5cdC8vVGhpcyBtaWdodCBiZSBhIHJlZ3VsYXIgcHJvcGVydHksIG9yIGl0IG1heSBiZSBhIGdldHRlci9zZXR0ZXIgdGhlIHVzZXIgZGVmaW5lZCBpbiBhIGNsYXNzLlxuXHRpZiAoIGRlZiAmJiBoYXNHZXR0ZXJPclNldHRlcihkZWYpICkge1xuXHRcdGlmICh0eXBlb2YgZGVmLmVudW1lcmFibGUgPT09IFwidW5kZWZpbmVkXCIpXG5cdFx0XHRkZWYuZW51bWVyYWJsZSA9IHRydWU7XG5cdFx0aWYgKHR5cGVvZiBkZWYuY29uZmlndXJhYmxlID09PSBcInVuZGVmaW5lZFwiKVxuXHRcdFx0ZGVmLmNvbmZpZ3VyYWJsZSA9IHRydWU7XG5cdFx0cmV0dXJuIGRlZjtcblx0fSBlbHNlIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cbn1cblxuZnVuY3Rpb24gaGFzTm9uQ29uZmlndXJhYmxlKG9iaiwgaykge1xuXHR2YXIgcHJvcCA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3Iob2JqLCBrKTtcblx0aWYgKCFwcm9wKVxuXHRcdHJldHVybiBmYWxzZTtcblxuXHRpZiAocHJvcC52YWx1ZSAmJiB0eXBlb2YgcHJvcC52YWx1ZSA9PT0gXCJvYmplY3RcIilcblx0XHRwcm9wID0gcHJvcC52YWx1ZTtcblxuXHRpZiAocHJvcC5jb25maWd1cmFibGUgPT09IGZhbHNlKSBcblx0XHRyZXR1cm4gdHJ1ZTtcblxuXHRyZXR1cm4gZmFsc2U7XG59XG5cbi8vVE9ETzogT24gY3JlYXRlLCBcbi8vXHRcdE9uIG1peGluLCBcblxuZnVuY3Rpb24gZXh0ZW5kKGN0b3IsIGRlZmluaXRpb24sIGlzQ2xhc3NEZXNjcmlwdG9yLCBleHRlbmQpIHtcblx0Zm9yICh2YXIgayBpbiBkZWZpbml0aW9uKSB7XG5cdFx0aWYgKCFkZWZpbml0aW9uLmhhc093blByb3BlcnR5KGspKVxuXHRcdFx0Y29udGludWU7XG5cblx0XHR2YXIgZGVmID0gZ2V0UHJvcGVydHkoZGVmaW5pdGlvbiwgaywgaXNDbGFzc0Rlc2NyaXB0b3IpO1xuXG5cdFx0aWYgKGRlZiAhPT0gZmFsc2UpIHtcblx0XHRcdC8vSWYgRXh0ZW5kcyBpcyB1c2VkLCB3ZSB3aWxsIGNoZWNrIGl0cyBwcm90b3R5cGUgdG8gc2VlIGlmIFxuXHRcdFx0Ly90aGUgZmluYWwgdmFyaWFibGUgZXhpc3RzLlxuXHRcdFx0XG5cdFx0XHR2YXIgcGFyZW50ID0gZXh0ZW5kIHx8IGN0b3I7XG5cdFx0XHRpZiAoaGFzTm9uQ29uZmlndXJhYmxlKHBhcmVudC5wcm90b3R5cGUsIGspKSB7XG5cblx0XHRcdFx0Ly9qdXN0IHNraXAgdGhlIGZpbmFsIHByb3BlcnR5XG5cdFx0XHRcdGlmIChDbGFzcy5pZ25vcmVGaW5hbHMpXG5cdFx0XHRcdFx0Y29udGludWU7XG5cblx0XHRcdFx0Ly9XZSBjYW5ub3QgcmUtZGVmaW5lIGEgcHJvcGVydHkgdGhhdCBpcyBjb25maWd1cmFibGU9ZmFsc2UuXG5cdFx0XHRcdC8vU28gd2Ugd2lsbCBjb25zaWRlciB0aGVtIGZpbmFsIGFuZCB0aHJvdyBhbiBlcnJvci4gVGhpcyBpcyBieVxuXHRcdFx0XHQvL2RlZmF1bHQgc28gaXQgaXMgY2xlYXIgdG8gdGhlIGRldmVsb3BlciB3aGF0IGlzIGhhcHBlbmluZy5cblx0XHRcdFx0Ly9Zb3UgY2FuIHNldCBpZ25vcmVGaW5hbHMgdG8gdHJ1ZSBpZiB5b3UgbmVlZCB0byBleHRlbmQgYSBjbGFzc1xuXHRcdFx0XHQvL3doaWNoIGhhcyBjb25maWd1cmFibGU9ZmFsc2U7IGl0IHdpbGwgc2ltcGx5IG5vdCByZS1kZWZpbmUgZmluYWwgcHJvcGVydGllcy5cblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiY2Fubm90IG92ZXJyaWRlIGZpbmFsIHByb3BlcnR5ICdcIitrXG5cdFx0XHRcdFx0XHRcdCtcIicsIHNldCBDbGFzcy5pZ25vcmVGaW5hbHMgPSB0cnVlIHRvIHNraXBcIik7XG5cdFx0XHR9XG5cblx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShjdG9yLnByb3RvdHlwZSwgaywgZGVmKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y3Rvci5wcm90b3R5cGVba10gPSBkZWZpbml0aW9uW2tdO1xuXHRcdH1cblxuXHR9XG59XG5cbi8qKlxuICovXG5mdW5jdGlvbiBtaXhpbihteUNsYXNzLCBtaXhpbnMpIHtcblx0aWYgKCFtaXhpbnMpXG5cdFx0cmV0dXJuO1xuXG5cdGlmICghQXJyYXkuaXNBcnJheShtaXhpbnMpKVxuXHRcdG1peGlucyA9IFttaXhpbnNdO1xuXG5cdGZvciAodmFyIGk9MDsgaTxtaXhpbnMubGVuZ3RoOyBpKyspIHtcblx0XHRleHRlbmQobXlDbGFzcywgbWl4aW5zW2ldLnByb3RvdHlwZSB8fCBtaXhpbnNbaV0pO1xuXHR9XG59XG5cbi8qKlxuICogXG4gKi9cbmZ1bmN0aW9uIENsYXNzKGRlZmluaXRpb24pIHtcblx0aWYgKCFkZWZpbml0aW9uKVxuXHRcdGRlZmluaXRpb24gPSB7fTtcblxuXHQvL1RoZSB2YXJpYWJsZSBuYW1lIGhlcmUgZGljdGF0ZXMgd2hhdCB3ZSBzZWUgaW4gQ2hyb21lIGRlYnVnZ2VyXG5cdHZhciBpbml0aWFsaXplO1xuXHR2YXIgRXh0ZW5kcztcblxuXHRpZiAoZGVmaW5pdGlvbi5pbml0aWFsaXplKSB7XG5cdFx0aWYgKHR5cGVvZiBkZWZpbml0aW9uLmluaXRpYWxpemUgIT09IFwiZnVuY3Rpb25cIilcblx0XHRcdHRocm93IG5ldyBFcnJvcihcImluaXRpYWxpemUgbXVzdCBiZSBhIGZ1bmN0aW9uXCIpO1xuXHRcdGluaXRpYWxpemUgPSBkZWZpbml0aW9uLmluaXRpYWxpemU7XG5cblx0XHQvL1VzdWFsbHkgd2Ugc2hvdWxkIGF2b2lkIFwiZGVsZXRlXCIgaW4gVjggYXQgYWxsIGNvc3RzLlxuXHRcdC8vSG93ZXZlciwgaXRzIHVubGlrZWx5IHRvIG1ha2UgYW55IHBlcmZvcm1hbmNlIGRpZmZlcmVuY2Vcblx0XHQvL2hlcmUgc2luY2Ugd2Ugb25seSBjYWxsIHRoaXMgb24gY2xhc3MgY3JlYXRpb24gKGkuZS4gbm90IG9iamVjdCBjcmVhdGlvbikuXG5cdFx0ZGVsZXRlIGRlZmluaXRpb24uaW5pdGlhbGl6ZTtcblx0fSBlbHNlIHtcblx0XHRpZiAoZGVmaW5pdGlvbi5FeHRlbmRzKSB7XG5cdFx0XHR2YXIgYmFzZSA9IGRlZmluaXRpb24uRXh0ZW5kcztcblx0XHRcdGluaXRpYWxpemUgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGJhc2UuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcblx0XHRcdH07IFxuXHRcdH0gZWxzZSB7XG5cdFx0XHRpbml0aWFsaXplID0gZnVuY3Rpb24gKCkge307IFxuXHRcdH1cblx0fVxuXG5cdGlmIChkZWZpbml0aW9uLkV4dGVuZHMpIHtcblx0XHRpbml0aWFsaXplLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoZGVmaW5pdGlvbi5FeHRlbmRzLnByb3RvdHlwZSk7XG5cdFx0aW5pdGlhbGl6ZS5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBpbml0aWFsaXplO1xuXHRcdC8vZm9yIGdldE93blByb3BlcnR5RGVzY3JpcHRvciB0byB3b3JrLCB3ZSBuZWVkIHRvIGFjdFxuXHRcdC8vZGlyZWN0bHkgb24gdGhlIEV4dGVuZHMgKG9yIE1peGluKVxuXHRcdEV4dGVuZHMgPSBkZWZpbml0aW9uLkV4dGVuZHM7XG5cdFx0ZGVsZXRlIGRlZmluaXRpb24uRXh0ZW5kcztcblx0fSBlbHNlIHtcblx0XHRpbml0aWFsaXplLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IGluaXRpYWxpemU7XG5cdH1cblxuXHQvL0dyYWIgdGhlIG1peGlucywgaWYgdGhleSBhcmUgc3BlY2lmaWVkLi4uXG5cdHZhciBtaXhpbnMgPSBudWxsO1xuXHRpZiAoZGVmaW5pdGlvbi5NaXhpbnMpIHtcblx0XHRtaXhpbnMgPSBkZWZpbml0aW9uLk1peGlucztcblx0XHRkZWxldGUgZGVmaW5pdGlvbi5NaXhpbnM7XG5cdH1cblxuXHQvL0ZpcnN0LCBtaXhpbiBpZiB3ZSBjYW4uXG5cdG1peGluKGluaXRpYWxpemUsIG1peGlucyk7XG5cblx0Ly9Ob3cgd2UgZ3JhYiB0aGUgYWN0dWFsIGRlZmluaXRpb24gd2hpY2ggZGVmaW5lcyB0aGUgb3ZlcnJpZGVzLlxuXHRleHRlbmQoaW5pdGlhbGl6ZSwgZGVmaW5pdGlvbiwgdHJ1ZSwgRXh0ZW5kcyk7XG5cblx0cmV0dXJuIGluaXRpYWxpemU7XG59O1xuXG5DbGFzcy5leHRlbmQgPSBleHRlbmQ7XG5DbGFzcy5taXhpbiA9IG1peGluO1xuQ2xhc3MuaWdub3JlRmluYWxzID0gZmFsc2U7XG5cbm1vZHVsZS5leHBvcnRzID0gQ2xhc3M7IiwiLyoqXG4gKiBUaGUgY29yZSBrYW1pIG1vZHVsZSBwcm92aWRlcyBiYXNpYyAyRCBzcHJpdGUgYmF0Y2hpbmcgYW5kIFxuICogYXNzZXQgbWFuYWdlbWVudC5cbiAqIFxuICogQG1vZHVsZSBrYW1pXG4gKi9cblxudmFyIENsYXNzID0gcmVxdWlyZSgna2xhc3NlJyk7XG52YXIgTWVzaCA9IHJlcXVpcmUoJy4vZ2x1dGlscy9NZXNoJyk7XG5cbnZhciBjb2xvclRvRmxvYXQgPSByZXF1aXJlKCdudW1iZXItdXRpbCcpLmNvbG9yVG9GbG9hdDtcblxuLyoqIFxuICogQSBiYXRjaGVyIG1peGluIGNvbXBvc2VkIG9mIHF1YWRzICh0d28gdHJpcywgaW5kZXhlZCkuIFxuICpcbiAqIFRoaXMgaXMgdXNlZCBpbnRlcm5hbGx5OyB1c2VycyBzaG91bGQgbG9vayBhdCBcbiAqIHt7I2Nyb3NzTGluayBcIlNwcml0ZUJhdGNoXCJ9fXt7L2Nyb3NzTGlua319IGluc3RlYWQsIHdoaWNoIGluaGVyaXRzIGZyb20gdGhpc1xuICogY2xhc3MuXG4gKiBcbiAqIFRoZSBiYXRjaGVyIGl0c2VsZiBpcyBub3QgbWFuYWdlZCBieSBXZWJHTENvbnRleHQ7IGhvd2V2ZXIsIGl0IG1ha2VzXG4gKiB1c2Ugb2YgTWVzaCBhbmQgVGV4dHVyZSB3aGljaCB3aWxsIGJlIG1hbmFnZWQuIEZvciB0aGlzIHJlYXNvbiwgdGhlIGJhdGNoZXJcbiAqIGRvZXMgbm90IGhvbGQgYSBkaXJlY3QgcmVmZXJlbmNlIHRvIHRoZSBHTCBzdGF0ZS5cbiAqXG4gKiBTdWJjbGFzc2VzIG11c3QgaW1wbGVtZW50IHRoZSBmb2xsb3dpbmc6ICBcbiAqIHt7I2Nyb3NzTGluayBcIkJhc2VCYXRjaC9fY3JlYXRlU2hhZGVyOm1ldGhvZFwifX17ey9jcm9zc0xpbmt9fSAgXG4gKiB7eyNjcm9zc0xpbmsgXCJCYXNlQmF0Y2gvX2NyZWF0ZVZlcnRleEF0dHJpYnV0ZXM6bWV0aG9kXCJ9fXt7L2Nyb3NzTGlua319ICBcbiAqIHt7I2Nyb3NzTGluayBcIkJhc2VCYXRjaC9nZXRWZXJ0ZXhTaXplOm1ldGhvZFwifX17ey9jcm9zc0xpbmt9fSAgXG4gKiBcbiAqIEBjbGFzcyAgQmFzZUJhdGNoXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSB7V2ViR0xDb250ZXh0fSBjb250ZXh0IHRoZSBjb250ZXh0IHRoaXMgYmF0Y2hlciBiZWxvbmdzIHRvXG4gKiBAcGFyYW0ge051bWJlcn0gc2l6ZSB0aGUgb3B0aW9uYWwgc2l6ZSBvZiB0aGlzIGJhdGNoLCBpLmUuIG1heCBudW1iZXIgb2YgcXVhZHNcbiAqIEBkZWZhdWx0ICA1MDBcbiAqL1xudmFyIEJhc2VCYXRjaCA9IG5ldyBDbGFzcyh7XG5cblx0Ly9Db25zdHJ1Y3RvclxuXHRpbml0aWFsaXplOiBmdW5jdGlvbiBCYXNlQmF0Y2goY29udGV4dCwgc2l6ZSkge1xuXHRcdGlmICh0eXBlb2YgY29udGV4dCAhPT0gXCJvYmplY3RcIilcblx0XHRcdHRocm93IFwiR0wgY29udGV4dCBub3Qgc3BlY2lmaWVkIHRvIFNwcml0ZUJhdGNoXCI7XG5cdFx0dGhpcy5jb250ZXh0ID0gY29udGV4dDtcblxuXHRcdHRoaXMuc2l6ZSA9IHNpemUgfHwgNTAwO1xuXHRcdFxuXHRcdC8vIDY1NTM1IGlzIG1heCBpbmRleCwgc28gNjU1MzUgLyA2ID0gMTA5MjIuXG5cdFx0aWYgKHRoaXMuc2l6ZSA+IDEwOTIyKSAgLy8oeW91J2QgaGF2ZSB0byBiZSBpbnNhbmUgdG8gdHJ5IGFuZCBiYXRjaCB0aGlzIG11Y2ggd2l0aCBXZWJHTClcblx0XHRcdHRocm93IFwiQ2FuJ3QgaGF2ZSBtb3JlIHRoYW4gMTA5MjIgc3ByaXRlcyBwZXIgYmF0Y2g6IFwiICsgdGhpcy5zaXplO1xuXHRcdFx0XHRcblx0XHRcblx0XHQvL1RPRE86IG1ha2UgdGhlc2UgcHVibGljXG5cdFx0dGhpcy5fYmxlbmRTcmMgPSB0aGlzLmNvbnRleHQuZ2wuT05FO1xuXHRcdHRoaXMuX2JsZW5kRHN0ID0gdGhpcy5jb250ZXh0LmdsLk9ORV9NSU5VU19TUkNfQUxQSEFcblx0XHR0aGlzLl9ibGVuZEVuYWJsZWQgPSB0cnVlO1xuXHRcdHRoaXMuX3NoYWRlciA9IHRoaXMuX2NyZWF0ZVNoYWRlcigpO1xuXG5cdFx0LyoqXG5cdFx0ICogVGhpcyBzaGFkZXIgd2lsbCBiZSB1c2VkIHdoZW5ldmVyIFwibnVsbFwiIGlzIHBhc3NlZFxuXHRcdCAqIGFzIHRoZSBiYXRjaCdzIHNoYWRlci4gXG5cdFx0ICpcblx0XHQgKiBAcHJvcGVydHkge1NoYWRlclByb2dyYW19IHNoYWRlclxuXHRcdCAqL1xuXHRcdHRoaXMuZGVmYXVsdFNoYWRlciA9IHRoaXMuX3NoYWRlcjtcblxuXHRcdC8qKlxuXHRcdCAqIEJ5IGRlZmF1bHQsIGEgU3ByaXRlQmF0Y2ggaXMgY3JlYXRlZCB3aXRoIGl0cyBvd24gU2hhZGVyUHJvZ3JhbSxcblx0XHQgKiBzdG9yZWQgaW4gYGRlZmF1bHRTaGFkZXJgLiBJZiB0aGlzIGZsYWcgaXMgdHJ1ZSwgb24gZGVsZXRpbmcgdGhlIFNwcml0ZUJhdGNoLCBpdHNcblx0XHQgKiBgZGVmYXVsdFNoYWRlcmAgd2lsbCBhbHNvIGJlIGRlbGV0ZWQuIElmIHRoaXMgZmxhZyBpcyBmYWxzZSwgbm8gc2hhZGVyc1xuXHRcdCAqIHdpbGwgYmUgZGVsZXRlZCBvbiBkZXN0cm95LlxuXHRcdCAqXG5cdFx0ICogTm90ZSB0aGF0IGlmIHlvdSByZS1hc3NpZ24gYGRlZmF1bHRTaGFkZXJgLCB5b3Ugd2lsbCBuZWVkIHRvIGRpc3Bvc2UgdGhlIHByZXZpb3VzXG5cdFx0ICogZGVmYXVsdCBzaGFkZXIgeW91cnNlbC4gXG5cdFx0ICpcblx0XHQgKiBAcHJvcGVydHkgb3duc1NoYWRlclxuXHRcdCAqIEB0eXBlIHtCb29sZWFufVxuXHRcdCAqL1xuXHRcdHRoaXMub3duc1NoYWRlciA9IHRydWU7XG5cblx0XHR0aGlzLmlkeCA9IDA7XG5cdFx0dGhpcy5kcmF3aW5nID0gZmFsc2U7XG5cblx0XHR0aGlzLm1lc2ggPSB0aGlzLl9jcmVhdGVNZXNoKHRoaXMuc2l6ZSk7XG5cblxuXHRcdC8qKlxuXHRcdCAqIFRoZSBBQkdSIHBhY2tlZCBjb2xvciwgYXMgYSBzaW5nbGUgZmxvYXQuIFRoZSBkZWZhdWx0XG5cdFx0ICogdmFsdWUgaXMgdGhlIGNvbG9yIHdoaXRlICgyNTUsIDI1NSwgMjU1LCAyNTUpLlxuXHRcdCAqXG5cdFx0ICogQHByb3BlcnR5IHtOdW1iZXJ9IGNvbG9yXG5cdFx0ICogQHJlYWRPbmx5IFxuXHRcdCAqL1xuXHRcdHRoaXMuY29sb3IgPSBjb2xvclRvRmxvYXQoMjU1LCAyNTUsIDI1NSwgMjU1KTtcblx0XHRcblx0XHQvKipcblx0XHQgKiBXaGV0aGVyIHRvIHByZW11bHRpcGx5IGFscGhhIG9uIGNhbGxzIHRvIHNldENvbG9yLiBcblx0XHQgKiBUaGlzIGlzIHRydWUgYnkgZGVmYXVsdCwgc28gdGhhdCB3ZSBjYW4gY29udmVuaWVudGx5IHdyaXRlOlxuXHRcdCAqXG5cdFx0ICogICAgIGJhdGNoLnNldENvbG9yKDEsIDAsIDAsIDAuMjUpOyAvL3RpbnRzIHJlZCB3aXRoIDI1JSBvcGFjaXR5XG5cdFx0ICpcblx0XHQgKiBJZiBmYWxzZSwgeW91IG11c3QgcHJlbXVsdGlwbHkgdGhlIGNvbG9ycyB5b3Vyc2VsZiB0byBhY2hpZXZlXG5cdFx0ICogdGhlIHNhbWUgdGludCwgbGlrZSBzbzpcblx0XHQgKlxuXHRcdCAqICAgICBiYXRjaC5zZXRDb2xvcigwLjI1LCAwLCAwLCAwLjI1KTtcblx0XHQgKiBcblx0XHQgKiBAcHJvcGVydHkgcHJlbXVsdGlwbGllZFxuXHRcdCAqIEB0eXBlIHtCb29sZWFufVxuXHRcdCAqIEBkZWZhdWx0ICB0cnVlXG5cdFx0ICovXG5cdFx0dGhpcy5wcmVtdWx0aXBsaWVkID0gdHJ1ZTtcblx0fSxcblxuXHQvKipcblx0ICogVGhpcyBpcyBhIHNldHRlci9nZXR0ZXIgZm9yIHRoaXMgYmF0Y2gncyBjdXJyZW50IFNoYWRlclByb2dyYW0uXG5cdCAqIElmIHRoaXMgaXMgc2V0IHdoZW4gdGhlIGJhdGNoIGlzIGRyYXdpbmcsIHRoZSBzdGF0ZSB3aWxsIGJlIGZsdXNoZWRcblx0ICogdG8gdGhlIEdQVSBhbmQgdGhlIG5ldyBzaGFkZXIgd2lsbCB0aGVuIGJlIGJvdW5kLlxuXHQgKlxuXHQgKiBJZiBgbnVsbGAgb3IgYSBmYWxzeSB2YWx1ZSBpcyBzcGVjaWZpZWQsIHRoZSBiYXRjaCdzIGBkZWZhdWx0U2hhZGVyYCB3aWxsIGJlIHVzZWQuIFxuXHQgKlxuXHQgKiBOb3RlIHRoYXQgc2hhZGVycyBhcmUgYm91bmQgb24gYmF0Y2guYmVnaW4oKS5cblx0ICpcblx0ICogQHByb3BlcnR5IHNoYWRlclxuXHQgKiBAdHlwZSB7U2hhZGVyUHJvZ3JhbX1cblx0ICovXG5cdHNoYWRlcjoge1xuXHRcdHNldDogZnVuY3Rpb24odmFsKSB7XG5cdFx0XHR2YXIgd2FzRHJhd2luZyA9IHRoaXMuZHJhd2luZztcblxuXHRcdFx0aWYgKHdhc0RyYXdpbmcpIHtcblx0XHRcdFx0dGhpcy5lbmQoKTsgLy91bmJpbmRzIHRoZSBzaGFkZXIgZnJvbSB0aGUgbWVzaFxuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl9zaGFkZXIgPSB2YWwgPyB2YWwgOiB0aGlzLmRlZmF1bHRTaGFkZXI7XG5cblx0XHRcdGlmICh3YXNEcmF3aW5nKSB7XG5cdFx0XHRcdHRoaXMuYmVnaW4oKTtcblx0XHRcdH1cblx0XHR9LFxuXG5cdFx0Z2V0OiBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiB0aGlzLl9zaGFkZXI7XG5cdFx0fVxuXHR9LFxuXG5cdC8qKlxuXHQgKiBTZXRzIHRoZSBjb2xvciBvZiB0aGlzIHNwcml0ZSBiYXRjaGVyLCB3aGljaCBpcyB1c2VkIGluIHN1YnNlcXVlbnQgZHJhd1xuXHQgKiBjYWxscy4gVGhpcyBkb2VzIG5vdCBmbHVzaCB0aGUgYmF0Y2guXG5cdCAqXG5cdCAqIElmIHRocmVlIG9yIG1vcmUgYXJndW1lbnRzIGFyZSBzcGVjaWZpZWQsIHRoaXMgbWV0aG9kIGFzc3VtZXMgdGhhdCBSR0IgXG5cdCAqIG9yIFJHQkEgZmxvYXQgdmFsdWVzICgwLjAgdG8gMS4wKSBhcmUgYmVpbmcgcGFzc2VkLiBcblx0ICogXG5cdCAqIElmIGxlc3MgdGhhbiB0aHJlZSBhcmd1bWVudHMgYXJlIHNwZWNpZmllZCwgd2Ugb25seSBjb25zaWRlciB0aGUgZmlyc3QgXG5cdCAqIGFuZCBhc3NpZ24gaXQgdG8gYWxsIGZvdXIgY29tcG9uZW50cyAtLSB0aGlzIGlzIHVzZWZ1bCBmb3Igc2V0dGluZyB0cmFuc3BhcmVuY3kgXG5cdCAqIGluIGEgcHJlbXVsdGlwbGllZCBhbHBoYSBzdGFnZS5cblx0ICpcblx0ICogQG1ldGhvZCAgc2V0Q29sb3Jcblx0ICogQHBhcmFtIHtOdW1iZXJ9IHIgdGhlIHJlZCBjb21wb25lbnQsIG5vcm1hbGl6ZWRcblx0ICogQHBhcmFtIHtOdW1iZXJ9IGcgdGhlIGdyZWVuIGNvbXBvbmVudCwgbm9ybWFsaXplZFxuXHQgKiBAcGFyYW0ge051bWJlcn0gYiB0aGUgYmx1ZSBjb21wb25lbnQsIG5vcm1hbGl6ZWRcblx0ICogQHBhcmFtIHtOdW1iZXJ9IGEgdGhlIGFscGhhIGNvbXBvbmVudCwgbm9ybWFsaXplZFxuXHQgKi9cblx0c2V0Q29sb3I6IGZ1bmN0aW9uKHIsIGcsIGIsIGEpIHtcblx0XHRpZiAoYXJndW1lbnRzLmxlbmd0aCA+PSAzKSB7XG5cdFx0XHQvL2RlZmF1bHQgYWxwaGEgdG8gb25lIFxuXHRcdFx0YSA9IChhIHx8IGEgPT09IDApID8gYSA6IDEuMDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0ciA9IGcgPSBiID0gYSA9IChhcmd1bWVudHNbMF0gfHwgMCk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMucHJlbXVsdGlwbGllZCkge1xuXHRcdFx0ciAqPSBhO1xuXHRcdFx0ZyAqPSBhO1xuXHRcdFx0YiAqPSBhO1xuXHRcdH1cblx0XHRcblx0XHR0aGlzLmNvbG9yID0gY29sb3JUb0Zsb2F0KFxuXHRcdFx0fn4ociAqIDI1NSksXG5cdFx0XHR+fihnICogMjU1KSxcblx0XHRcdH5+KGIgKiAyNTUpLFxuXHRcdFx0fn4oYSAqIDI1NSlcblx0XHQpO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBDYWxsZWQgZnJvbSB0aGUgY29uc3RydWN0b3IgdG8gY3JlYXRlIGEgbmV3IE1lc2ggXG5cdCAqIGJhc2VkIG9uIHRoZSBleHBlY3RlZCBiYXRjaCBzaXplLiBTaG91bGQgc2V0IHVwXG5cdCAqIHZlcnRzICYgaW5kaWNlcyBwcm9wZXJseS5cblx0ICpcblx0ICogVXNlcnMgc2hvdWxkIG5vdCBjYWxsIHRoaXMgZGlyZWN0bHk7IGluc3RlYWQsIGl0XG5cdCAqIHNob3VsZCBvbmx5IGJlIGltcGxlbWVudGVkIGJ5IHN1YmNsYXNzZXMuXG5cdCAqIFxuXHQgKiBAbWV0aG9kIF9jcmVhdGVNZXNoXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBzaXplIHRoZSBzaXplIHBhc3NlZCB0aHJvdWdoIHRoZSBjb25zdHJ1Y3RvclxuXHQgKi9cblx0X2NyZWF0ZU1lc2g6IGZ1bmN0aW9uKHNpemUpIHtcblx0XHQvL3RoZSB0b3RhbCBudW1iZXIgb2YgZmxvYXRzIGluIG91ciBiYXRjaFxuXHRcdHZhciBudW1WZXJ0cyA9IHNpemUgKiA0ICogdGhpcy5nZXRWZXJ0ZXhTaXplKCk7XG5cdFx0Ly90aGUgdG90YWwgbnVtYmVyIG9mIGluZGljZXMgaW4gb3VyIGJhdGNoXG5cdFx0dmFyIG51bUluZGljZXMgPSBzaXplICogNjtcblx0XHR2YXIgZ2wgPSB0aGlzLmNvbnRleHQuZ2w7XG5cblx0XHQvL3ZlcnRleCBkYXRhXG5cdFx0dGhpcy52ZXJ0aWNlcyA9IG5ldyBGbG9hdDMyQXJyYXkobnVtVmVydHMpO1xuXHRcdC8vaW5kZXggZGF0YVxuXHRcdHRoaXMuaW5kaWNlcyA9IG5ldyBVaW50MTZBcnJheShudW1JbmRpY2VzKTsgXG5cdFx0XG5cdFx0Zm9yICh2YXIgaT0wLCBqPTA7IGkgPCBudW1JbmRpY2VzOyBpICs9IDYsIGogKz0gNCkgXG5cdFx0e1xuXHRcdFx0dGhpcy5pbmRpY2VzW2kgKyAwXSA9IGogKyAwOyBcblx0XHRcdHRoaXMuaW5kaWNlc1tpICsgMV0gPSBqICsgMTtcblx0XHRcdHRoaXMuaW5kaWNlc1tpICsgMl0gPSBqICsgMjtcblx0XHRcdHRoaXMuaW5kaWNlc1tpICsgM10gPSBqICsgMDtcblx0XHRcdHRoaXMuaW5kaWNlc1tpICsgNF0gPSBqICsgMjtcblx0XHRcdHRoaXMuaW5kaWNlc1tpICsgNV0gPSBqICsgMztcblx0XHR9XG5cblx0XHR2YXIgbWVzaCA9IG5ldyBNZXNoKHRoaXMuY29udGV4dCwgZmFsc2UsIFxuXHRcdFx0XHRcdFx0bnVtVmVydHMsIG51bUluZGljZXMsIHRoaXMuX2NyZWF0ZVZlcnRleEF0dHJpYnV0ZXMoKSk7XG5cdFx0bWVzaC52ZXJ0aWNlcyA9IHRoaXMudmVydGljZXM7XG5cdFx0bWVzaC5pbmRpY2VzID0gdGhpcy5pbmRpY2VzO1xuXHRcdG1lc2gudmVydGV4VXNhZ2UgPSBnbC5EWU5BTUlDX0RSQVc7XG5cdFx0bWVzaC5pbmRleFVzYWdlID0gZ2wuU1RBVElDX0RSQVc7XG5cdFx0bWVzaC5kaXJ0eSA9IHRydWU7XG5cdFx0cmV0dXJuIG1lc2g7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFJldHVybnMgYSBzaGFkZXIgZm9yIHRoaXMgYmF0Y2guIElmIHlvdSBwbGFuIHRvIHN1cHBvcnRcblx0ICogbXVsdGlwbGUgaW5zdGFuY2VzIG9mIHlvdXIgYmF0Y2gsIGl0IG1heSBvciBtYXkgbm90IGJlIHdpc2Vcblx0ICogdG8gdXNlIGEgc2hhcmVkIHNoYWRlciB0byBzYXZlIHJlc291cmNlcy5cblx0ICogXG5cdCAqIFRoaXMgbWV0aG9kIGluaXRpYWxseSB0aHJvd3MgYW4gZXJyb3I7IHNvIGl0IG11c3QgYmUgb3ZlcnJpZGRlbiBieVxuXHQgKiBzdWJjbGFzc2VzIG9mIEJhc2VCYXRjaC5cblx0ICpcblx0ICogQG1ldGhvZCAgX2NyZWF0ZVNoYWRlclxuXHQgKiBAcmV0dXJuIHtOdW1iZXJ9IHRoZSBzaXplIG9mIGEgdmVydGV4LCBpbiAjIG9mIGZsb2F0c1xuXHQgKi9cblx0X2NyZWF0ZVNoYWRlcjogZnVuY3Rpb24oKSB7XG5cdFx0dGhyb3cgXCJfY3JlYXRlU2hhZGVyIG5vdCBpbXBsZW1lbnRlZFwiXG5cdH0sXHRcblxuXHQvKipcblx0ICogUmV0dXJucyBhbiBhcnJheSBvZiB2ZXJ0ZXggYXR0cmlidXRlcyBmb3IgdGhpcyBtZXNoOyBcblx0ICogc3ViY2xhc3NlcyBzaG91bGQgaW1wbGVtZW50IHRoaXMgd2l0aCB0aGUgYXR0cmlidXRlcyBcblx0ICogZXhwZWN0ZWQgZm9yIHRoZWlyIGJhdGNoLlxuXHQgKlxuXHQgKiBUaGlzIG1ldGhvZCBpbml0aWFsbHkgdGhyb3dzIGFuIGVycm9yOyBzbyBpdCBtdXN0IGJlIG92ZXJyaWRkZW4gYnlcblx0ICogc3ViY2xhc3NlcyBvZiBCYXNlQmF0Y2guXG5cdCAqXG5cdCAqIEBtZXRob2QgX2NyZWF0ZVZlcnRleEF0dHJpYnV0ZXNcblx0ICogQHJldHVybiB7QXJyYXl9IGFuIGFycmF5IG9mIE1lc2guVmVydGV4QXR0cmliIG9iamVjdHNcblx0ICovXG5cdF9jcmVhdGVWZXJ0ZXhBdHRyaWJ1dGVzOiBmdW5jdGlvbigpIHtcblx0XHR0aHJvdyBcIl9jcmVhdGVWZXJ0ZXhBdHRyaWJ1dGVzIG5vdCBpbXBsZW1lbnRlZFwiO1xuXHR9LFxuXG5cblx0LyoqXG5cdCAqIFJldHVybnMgdGhlIG51bWJlciBvZiBmbG9hdHMgcGVyIHZlcnRleCBmb3IgdGhpcyBiYXRjaGVyLlxuXHQgKiBcblx0ICogVGhpcyBtZXRob2QgaW5pdGlhbGx5IHRocm93cyBhbiBlcnJvcjsgc28gaXQgbXVzdCBiZSBvdmVycmlkZGVuIGJ5XG5cdCAqIHN1YmNsYXNzZXMgb2YgQmFzZUJhdGNoLlxuXHQgKlxuXHQgKiBAbWV0aG9kICBnZXRWZXJ0ZXhTaXplXG5cdCAqIEByZXR1cm4ge051bWJlcn0gdGhlIHNpemUgb2YgYSB2ZXJ0ZXgsIGluICMgb2YgZmxvYXRzXG5cdCAqL1xuXHRnZXRWZXJ0ZXhTaXplOiBmdW5jdGlvbigpIHtcblx0XHR0aHJvdyBcImdldFZlcnRleFNpemUgbm90IGltcGxlbWVudGVkXCI7XG5cdH0sXG5cblx0XG5cdC8qKiBcblx0ICogQmVnaW5zIHRoZSBzcHJpdGUgYmF0Y2guIFRoaXMgd2lsbCBiaW5kIHRoZSBzaGFkZXJcblx0ICogYW5kIG1lc2guIFN1YmNsYXNzZXMgbWF5IHdhbnQgdG8gZGlzYWJsZSBkZXB0aCBvciBcblx0ICogc2V0IHVwIGJsZW5kaW5nLlxuXHQgKlxuXHQgKiBAbWV0aG9kICBiZWdpblxuXHQgKi9cblx0YmVnaW46IGZ1bmN0aW9uKCkgIHtcblx0XHRpZiAodGhpcy5kcmF3aW5nKSBcblx0XHRcdHRocm93IFwiYmF0Y2guZW5kKCkgbXVzdCBiZSBjYWxsZWQgYmVmb3JlIGJlZ2luXCI7XG5cdFx0dGhpcy5kcmF3aW5nID0gdHJ1ZTtcblxuXHRcdHRoaXMuc2hhZGVyLmJpbmQoKTtcblxuXHRcdC8vYmluZCB0aGUgYXR0cmlidXRlcyBub3cgdG8gYXZvaWQgcmVkdW5kYW50IGNhbGxzXG5cdFx0dGhpcy5tZXNoLmJpbmQodGhpcy5zaGFkZXIpO1xuXHR9LFxuXG5cdC8qKiBcblx0ICogRW5kcyB0aGUgc3ByaXRlIGJhdGNoLiBUaGlzIHdpbGwgZmx1c2ggYW55IHJlbWFpbmluZyBcblx0ICogZGF0YSBhbmQgc2V0IEdMIHN0YXRlIGJhY2sgdG8gbm9ybWFsLlxuXHQgKiBcblx0ICogQG1ldGhvZCAgZW5kXG5cdCAqL1xuXHRlbmQ6IGZ1bmN0aW9uKCkgIHtcblx0XHRpZiAoIXRoaXMuZHJhd2luZylcblx0XHRcdHRocm93IFwiYmF0Y2guYmVnaW4oKSBtdXN0IGJlIGNhbGxlZCBiZWZvcmUgZW5kXCI7XG5cdFx0aWYgKHRoaXMuaWR4ID4gMClcblx0XHRcdHRoaXMuZmx1c2goKTtcblx0XHR0aGlzLmRyYXdpbmcgPSBmYWxzZTtcblxuXHRcdHRoaXMubWVzaC51bmJpbmQodGhpcy5zaGFkZXIpO1xuXHR9LFxuXG5cdC8qKiBcblx0ICogQ2FsbGVkIGJlZm9yZSByZW5kZXJpbmcgdG8gYmluZCBuZXcgdGV4dHVyZXMuXG5cdCAqIFRoaXMgbWV0aG9kIGRvZXMgbm90aGluZyBieSBkZWZhdWx0LlxuXHQgKlxuXHQgKiBAbWV0aG9kICBfcHJlUmVuZGVyXG5cdCAqL1xuXHRfcHJlUmVuZGVyOiBmdW5jdGlvbigpICB7XG5cdH0sXG5cblx0LyoqIFxuXHQgKiBDYWxsZWQgYWZ0ZXIgZmx1c2hpbmcgdGhlIGJhdGNoLiBUaGlzIG1ldGhvZFxuXHQgKiBkb2VzIG5vdGhpbmcgYnkgZGVmYXVsdC5cblx0ICpcblx0ICogQG1ldGhvZCAgX3Bvc3RSZW5kZXJcblx0ICovXG5cdF9wb3N0UmVuZGVyOiBmdW5jdGlvbigpIHtcblx0fSxcblxuXHQvKipcblx0ICogRmx1c2hlcyB0aGUgYmF0Y2ggYnkgcHVzaGluZyB0aGUgY3VycmVudCBkYXRhXG5cdCAqIHRvIEdMLlxuXHQgKiBcblx0ICogQG1ldGhvZCBmbHVzaFxuXHQgKi9cblx0Zmx1c2g6IGZ1bmN0aW9uKCkgIHtcblx0XHRpZiAodGhpcy5pZHg9PT0wKVxuXHRcdFx0cmV0dXJuO1xuXG5cdFx0dmFyIGdsID0gdGhpcy5nbDtcblx0XHRcblx0XHR0aGlzLl9wcmVSZW5kZXIoKTtcblxuXHRcdC8vbnVtYmVyIG9mIHNwcml0ZXMgaW4gYmF0Y2hcblx0XHR2YXIgbnVtQ29tcG9uZW50cyA9IHRoaXMuZ2V0VmVydGV4U2l6ZSgpO1xuXHRcdHZhciBzcHJpdGVDb3VudCA9ICh0aGlzLmlkeCAvIChudW1Db21wb25lbnRzICogNCkpO1xuXHRcdFxuXHRcdC8vZHJhdyB0aGUgc3ByaXRlc1xuXHRcdHZhciBnbCA9IHRoaXMuY29udGV4dC5nbDtcblx0XHR0aGlzLm1lc2gudmVydGljZXNEaXJ0eSA9IHRydWU7XG5cdFx0dGhpcy5tZXNoLmRyYXcoZ2wuVFJJQU5HTEVTLCBzcHJpdGVDb3VudCAqIDYsIDAsIHRoaXMuaWR4KTtcblxuXHRcdHRoaXMuaWR4ID0gMDtcblx0fSxcblxuXHQvKipcblx0ICogQWRkcyBhIHNwcml0ZSB0byB0aGlzIGJhdGNoLlxuXHQgKiBUaGUgc3BlY2lmaWNzIGRlcGVuZCBvbiB0aGUgc3ByaXRlIGJhdGNoIGltcGxlbWVudGF0aW9uLlxuXHQgKlxuXHQgKiBAbWV0aG9kIGRyYXdcblx0ICogQHBhcmFtICB7VGV4dHVyZX0gdGV4dHVyZSB0aGUgdGV4dHVyZSBmb3IgdGhpcyBzcHJpdGVcblx0ICogQHBhcmFtICB7TnVtYmVyfSB4ICAgICAgIHRoZSB4IHBvc2l0aW9uLCBkZWZhdWx0cyB0byB6ZXJvXG5cdCAqIEBwYXJhbSAge051bWJlcn0geSAgICAgICB0aGUgeSBwb3NpdGlvbiwgZGVmYXVsdHMgdG8gemVyb1xuXHQgKiBAcGFyYW0gIHtOdW1iZXJ9IHdpZHRoICAgdGhlIHdpZHRoLCBkZWZhdWx0cyB0byB0aGUgdGV4dHVyZSB3aWR0aFxuXHQgKiBAcGFyYW0gIHtOdW1iZXJ9IGhlaWdodCAgdGhlIGhlaWdodCwgZGVmYXVsdHMgdG8gdGhlIHRleHR1cmUgaGVpZ2h0XG5cdCAqIEBwYXJhbSAge051bWJlcn0gdTEgICAgICB0aGUgZmlyc3QgVSBjb29yZGluYXRlLCBkZWZhdWx0IHplcm9cblx0ICogQHBhcmFtICB7TnVtYmVyfSB2MSAgICAgIHRoZSBmaXJzdCBWIGNvb3JkaW5hdGUsIGRlZmF1bHQgemVyb1xuXHQgKiBAcGFyYW0gIHtOdW1iZXJ9IHUyICAgICAgdGhlIHNlY29uZCBVIGNvb3JkaW5hdGUsIGRlZmF1bHQgb25lXG5cdCAqIEBwYXJhbSAge051bWJlcn0gdjIgICAgICB0aGUgc2Vjb25kIFYgY29vcmRpbmF0ZSwgZGVmYXVsdCBvbmVcblx0ICovXG5cdGRyYXc6IGZ1bmN0aW9uKHRleHR1cmUsIHgsIHksIHdpZHRoLCBoZWlnaHQsIHUxLCB2MSwgdTIsIHYyKSB7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEFkZHMgYSBzaW5nbGUgcXVhZCBtZXNoIHRvIHRoaXMgc3ByaXRlIGJhdGNoIGZyb20gdGhlIGdpdmVuXG5cdCAqIGFycmF5IG9mIHZlcnRpY2VzLlxuXHQgKiBUaGUgc3BlY2lmaWNzIGRlcGVuZCBvbiB0aGUgc3ByaXRlIGJhdGNoIGltcGxlbWVudGF0aW9uLlxuXHQgKlxuXHQgKiBAbWV0aG9kICBkcmF3VmVydGljZXNcblx0ICogQHBhcmFtIHtUZXh0dXJlfSB0ZXh0dXJlIHRoZSB0ZXh0dXJlIHdlIGFyZSBkcmF3aW5nIGZvciB0aGlzIHNwcml0ZVxuXHQgKiBAcGFyYW0ge0Zsb2F0MzJBcnJheX0gdmVydHMgYW4gYXJyYXkgb2YgdmVydGljZXNcblx0ICogQHBhcmFtIHtOdW1iZXJ9IG9mZiB0aGUgb2Zmc2V0IGludG8gdGhlIHZlcnRpY2VzIGFycmF5IHRvIHJlYWQgZnJvbVxuXHQgKi9cblx0ZHJhd1ZlcnRpY2VzOiBmdW5jdGlvbih0ZXh0dXJlLCB2ZXJ0cywgb2ZmKSAge1xuXHR9LFxuXG5cdGRyYXdSZWdpb246IGZ1bmN0aW9uKHJlZ2lvbiwgeCwgeSwgd2lkdGgsIGhlaWdodCkge1xuXHRcdHRoaXMuZHJhdyhyZWdpb24udGV4dHVyZSwgeCwgeSwgd2lkdGgsIGhlaWdodCwgcmVnaW9uLnUsIHJlZ2lvbi52LCByZWdpb24udTIsIHJlZ2lvbi52Mik7XG5cdH0sXG5cblx0LyoqXG5cdCAqIERlc3Ryb3lzIHRoZSBiYXRjaCwgZGVsZXRpbmcgaXRzIGJ1ZmZlcnMgYW5kIHJlbW92aW5nIGl0IGZyb20gdGhlXG5cdCAqIFdlYkdMQ29udGV4dCBtYW5hZ2VtZW50LiBUcnlpbmcgdG8gdXNlIHRoaXNcblx0ICogYmF0Y2ggYWZ0ZXIgZGVzdHJveWluZyBpdCBjYW4gbGVhZCB0byB1bnByZWRpY3RhYmxlIGJlaGF2aW91ci5cblx0ICpcblx0ICogSWYgYG93bnNTaGFkZXJgIGlzIHRydWUsIHRoaXMgd2lsbCBhbHNvIGRlbGV0ZSB0aGUgYGRlZmF1bHRTaGFkZXJgIG9iamVjdC5cblx0ICogXG5cdCAqIEBtZXRob2QgZGVzdHJveVxuXHQgKi9cblx0ZGVzdHJveTogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy52ZXJ0aWNlcyA9IFtdO1xuXHRcdHRoaXMuaW5kaWNlcyA9IFtdO1xuXHRcdHRoaXMuc2l6ZSA9IHRoaXMubWF4VmVydGljZXMgPSAwO1xuXG5cdFx0aWYgKHRoaXMuZGVmYXVsdFNoYWRlcilcblx0XHRcdHRoaXMuZGVmYXVsdFNoYWRlci5kZXN0cm95KCk7XG5cdFx0dGhpcy5kZWZhdWx0U2hhZGVyID0gbnVsbDtcblx0XHR0aGlzLl9zaGFkZXIgPSBudWxsOyAvLyByZW1vdmUgcmVmZXJlbmNlIHRvIHdoYXRldmVyIHNoYWRlciBpcyBjdXJyZW50bHkgYmVpbmcgdXNlZFxuXG5cdFx0aWYgKHRoaXMubWVzaCkgXG5cdFx0XHR0aGlzLm1lc2guZGVzdHJveSgpO1xuXHRcdHRoaXMubWVzaCA9IG51bGw7XG5cdH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEJhc2VCYXRjaDtcbiIsIi8qKlxuICogQG1vZHVsZSBrYW1pXG4gKi9cblxuLy8gUmVxdWlyZXMuLi4uXG52YXIgQ2xhc3MgICAgICAgICA9IHJlcXVpcmUoJ2tsYXNzZScpO1xuXG52YXIgQmFzZUJhdGNoID0gcmVxdWlyZSgnLi9CYXNlQmF0Y2gnKTtcblxudmFyIE1lc2ggICAgICAgICAgPSByZXF1aXJlKCcuL2dsdXRpbHMvTWVzaCcpO1xudmFyIFNoYWRlclByb2dyYW0gPSByZXF1aXJlKCcuL2dsdXRpbHMvU2hhZGVyUHJvZ3JhbScpO1xuXG4vKipcbiAqIEEgYmFzaWMgaW1wbGVtZW50YXRpb24gb2YgYSBiYXRjaGVyIHdoaWNoIGRyYXdzIDJEIHNwcml0ZXMuXG4gKiBUaGlzIHVzZXMgdHdvIHRyaWFuZ2xlcyAocXVhZHMpIHdpdGggaW5kZXhlZCBhbmQgaW50ZXJsZWF2ZWRcbiAqIHZlcnRleCBkYXRhLiBFYWNoIHZlcnRleCBob2xkcyA1IGZsb2F0cyAoUG9zaXRpb24ueHksIENvbG9yLCBUZXhDb29yZDAueHkpLlxuICpcbiAqIFRoZSBjb2xvciBpcyBwYWNrZWQgaW50byBhIHNpbmdsZSBmbG9hdCB0byByZWR1Y2UgdmVydGV4IGJhbmR3aWR0aCwgYW5kXG4gKiB0aGUgZGF0YSBpcyBpbnRlcmxlYXZlZCBmb3IgYmVzdCBwZXJmb3JtYW5jZS4gV2UgdXNlIGEgc3RhdGljIGluZGV4IGJ1ZmZlcixcbiAqIGFuZCBhIGR5bmFtaWMgdmVydGV4IGJ1ZmZlciB0aGF0IGlzIHVwZGF0ZWQgd2l0aCBidWZmZXJTdWJEYXRhLiBcbiAqIFxuICogQGV4YW1wbGVcbiAqICAgICAgdmFyIFNwcml0ZUJhdGNoID0gcmVxdWlyZSgna2FtaScpLlNwcml0ZUJhdGNoOyAgXG4gKiAgICAgIFxuICogICAgICAvL2NyZWF0ZSBhIG5ldyBiYXRjaGVyXG4gKiAgICAgIHZhciBiYXRjaCA9IG5ldyBTcHJpdGVCYXRjaChjb250ZXh0KTtcbiAqXG4gKiAgICAgIGZ1bmN0aW9uIHJlbmRlcigpIHtcbiAqICAgICAgICAgIGJhdGNoLmJlZ2luKCk7XG4gKiAgICAgICAgICBcbiAqICAgICAgICAgIC8vZHJhdyBzb21lIHNwcml0ZXMgaW4gYmV0d2VlbiBiZWdpbiBhbmQgZW5kLi4uXG4gKiAgICAgICAgICBiYXRjaC5kcmF3KCB0ZXh0dXJlLCAwLCAwLCAyNSwgMzIgKTtcbiAqICAgICAgICAgIGJhdGNoLmRyYXcoIHRleHR1cmUxLCAwLCAyNSwgNDIsIDIzICk7XG4gKiBcbiAqICAgICAgICAgIGJhdGNoLmVuZCgpO1xuICogICAgICB9XG4gKiBcbiAqIEBjbGFzcyAgU3ByaXRlQmF0Y2hcbiAqIEB1c2VzIEJhc2VCYXRjaFxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0ge1dlYkdMQ29udGV4dH0gY29udGV4dCB0aGUgY29udGV4dCBmb3IgdGhpcyBiYXRjaFxuICogQHBhcmFtIHtOdW1iZXJ9IHNpemUgdGhlIG1heCBudW1iZXIgb2Ygc3ByaXRlcyB0byBmaXQgaW4gYSBzaW5nbGUgYmF0Y2hcbiAqL1xudmFyIFNwcml0ZUJhdGNoID0gbmV3IENsYXNzKHtcblxuXHQvL2luaGVyaXQgc29tZSBzdHVmZiBvbnRvIHRoaXMgcHJvdG90eXBlXG5cdE1peGluczogQmFzZUJhdGNoLFxuXG5cdC8vQ29uc3RydWN0b3Jcblx0aW5pdGlhbGl6ZTogZnVuY3Rpb24gU3ByaXRlQmF0Y2goY29udGV4dCwgc2l6ZSkge1xuXHRcdEJhc2VCYXRjaC5jYWxsKHRoaXMsIGNvbnRleHQsIHNpemUpO1xuXG5cdFx0LyoqXG5cdFx0ICogVGhlIHByb2plY3Rpb24gRmxvYXQzMkFycmF5IHZlYzIgd2hpY2ggaXNcblx0XHQgKiB1c2VkIHRvIGF2b2lkIHNvbWUgbWF0cml4IGNhbGN1bGF0aW9ucy5cblx0XHQgKlxuXHRcdCAqIEBwcm9wZXJ0eSBwcm9qZWN0aW9uXG5cdFx0ICogQHR5cGUge0Zsb2F0MzJBcnJheX1cblx0XHQgKi9cblx0XHR0aGlzLnByb2plY3Rpb24gPSBuZXcgRmxvYXQzMkFycmF5KDIpO1xuXG5cdFx0Ly9TZXRzIHVwIGEgZGVmYXVsdCBwcm9qZWN0aW9uIHZlY3RvciBzbyB0aGF0IHRoZSBiYXRjaCB3b3JrcyB3aXRob3V0IHNldFByb2plY3Rpb25cblx0XHR0aGlzLnByb2plY3Rpb25bMF0gPSB0aGlzLmNvbnRleHQud2lkdGgvMjtcblx0XHR0aGlzLnByb2plY3Rpb25bMV0gPSB0aGlzLmNvbnRleHQuaGVpZ2h0LzI7XG5cblx0XHQvKipcblx0XHQgKiBUaGUgY3VycmVudGx5IGJvdW5kIHRleHR1cmUuIERvIG5vdCBtb2RpZnkuXG5cdFx0ICogXG5cdFx0ICogQHByb3BlcnR5IHtUZXh0dXJlfSB0ZXh0dXJlXG5cdFx0ICogQHJlYWRPbmx5XG5cdFx0ICovXG5cdFx0dGhpcy50ZXh0dXJlID0gbnVsbDtcblx0fSxcblxuXHQvKipcblx0ICogVGhpcyBpcyBhIGNvbnZlbmllbmNlIGZ1bmN0aW9uIHRvIHNldCB0aGUgYmF0Y2gncyBwcm9qZWN0aW9uXG5cdCAqIG1hdHJpeCB0byBhbiBvcnRob2dyYXBoaWMgMkQgcHJvamVjdGlvbiwgYmFzZWQgb24gdGhlIGdpdmVuIHNjcmVlblxuXHQgKiBzaXplLiBUaGlzIGFsbG93cyB1c2VycyB0byByZW5kZXIgaW4gMkQgd2l0aG91dCBhbnkgbmVlZCBmb3IgYSBjYW1lcmEuXG5cdCAqIFxuXHQgKiBAcGFyYW0gIHtbdHlwZV19IHdpZHRoICBbZGVzY3JpcHRpb25dXG5cdCAqIEBwYXJhbSAge1t0eXBlXX0gaGVpZ2h0IFtkZXNjcmlwdGlvbl1cblx0ICogQHJldHVybiB7W3R5cGVdfSAgICAgICAgW2Rlc2NyaXB0aW9uXVxuXHQgKi9cblx0cmVzaXplOiBmdW5jdGlvbih3aWR0aCwgaGVpZ2h0KSB7XG5cdFx0dGhpcy5zZXRQcm9qZWN0aW9uKHdpZHRoLzIsIGhlaWdodC8yKTtcblx0fSxcblxuXHQvKipcblx0ICogVGhlIG51bWJlciBvZiBmbG9hdHMgcGVyIHZlcnRleCBmb3IgdGhpcyBiYXRjaGVyIFxuXHQgKiAoUG9zaXRpb24ueHkgKyBDb2xvciArIFRleENvb3JkMC54eSkuXG5cdCAqXG5cdCAqIEBtZXRob2QgIGdldFZlcnRleFNpemVcblx0ICogQHJldHVybiB7TnVtYmVyfSB0aGUgbnVtYmVyIG9mIGZsb2F0cyBwZXIgdmVydGV4XG5cdCAqL1xuXHRnZXRWZXJ0ZXhTaXplOiBmdW5jdGlvbigpIHtcblx0XHRyZXR1cm4gU3ByaXRlQmF0Y2guVkVSVEVYX1NJWkU7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFVzZWQgaW50ZXJuYWxseSB0byByZXR1cm4gdGhlIFBvc2l0aW9uLCBDb2xvciwgYW5kIFRleENvb3JkMCBhdHRyaWJ1dGVzLlxuXHQgKlxuXHQgKiBAbWV0aG9kICBfY3JlYXRlVmVydGV4QXR0cmlidWV0c1xuXHQgKiBAcHJvdGVjdGVkXG5cdCAqIEByZXR1cm4ge1t0eXBlXX0gW2Rlc2NyaXB0aW9uXVxuXHQgKi9cblx0X2NyZWF0ZVZlcnRleEF0dHJpYnV0ZXM6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBnbCA9IHRoaXMuY29udGV4dC5nbDtcblxuXHRcdHJldHVybiBbIFxuXHRcdFx0bmV3IE1lc2guQXR0cmliKFwiUG9zaXRpb25cIiwgMiksXG5cdFx0XHQgLy9wYWNrIHRoZSBjb2xvciB1c2luZyBzb21lIGNyYXp5IHdpemFyZHJ5IFxuXHRcdFx0bmV3IE1lc2guQXR0cmliKFwiQ29sb3JcIiwgNCwgbnVsbCwgZ2wuVU5TSUdORURfQllURSwgdHJ1ZSwgMSksXG5cdFx0XHRuZXcgTWVzaC5BdHRyaWIoXCJUZXhDb29yZDBcIiwgMilcblx0XHRdO1xuXHR9LFxuXG5cblx0LyoqXG5cdCAqIFNldHMgdGhlIHByb2plY3Rpb24gdmVjdG9yLCBhbiB4IGFuZCB5XG5cdCAqIGRlZmluaW5nIHRoZSBtaWRkbGUgcG9pbnRzIG9mIHlvdXIgc3RhZ2UuXG5cdCAqXG5cdCAqIEBtZXRob2Qgc2V0UHJvamVjdGlvblxuXHQgKiBAcGFyYW0ge051bWJlcn0geCB0aGUgeCBwcm9qZWN0aW9uIHZhbHVlXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSB5IHRoZSB5IHByb2plY3Rpb24gdmFsdWVcblx0ICovXG5cdHNldFByb2plY3Rpb246IGZ1bmN0aW9uKHgsIHkpIHtcblx0XHR2YXIgb2xkWCA9IHRoaXMucHJvamVjdGlvblswXTtcblx0XHR2YXIgb2xkWSA9IHRoaXMucHJvamVjdGlvblsxXTtcblx0XHR0aGlzLnByb2plY3Rpb25bMF0gPSB4O1xuXHRcdHRoaXMucHJvamVjdGlvblsxXSA9IHk7XG5cblx0XHQvL3dlIG5lZWQgdG8gZmx1c2ggdGhlIGJhdGNoLi5cblx0XHRpZiAodGhpcy5kcmF3aW5nICYmICh4ICE9IG9sZFggfHwgeSAhPSBvbGRZKSkge1xuXHRcdFx0dGhpcy5mbHVzaCgpO1xuXHRcdFx0dGhpcy5fdXBkYXRlTWF0cmljZXMoKTtcblx0XHR9XG5cdH0sXG5cblx0LyoqXG5cdCAqIENyZWF0ZXMgYSBkZWZhdWx0IHNoYWRlciBmb3IgdGhpcyBiYXRjaC5cblx0ICpcblx0ICogQG1ldGhvZCAgX2NyZWF0ZVNoYWRlclxuXHQgKiBAcHJvdGVjdGVkXG5cdCAqIEByZXR1cm4ge1NoYWRlclByb2dyYW19IGEgbmV3IGluc3RhbmNlIG9mIFNoYWRlclByb2dyYW1cblx0ICovXG5cdF9jcmVhdGVTaGFkZXI6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBzaGFkZXIgPSBuZXcgU2hhZGVyUHJvZ3JhbSh0aGlzLmNvbnRleHQsXG5cdFx0XHRcdFNwcml0ZUJhdGNoLkRFRkFVTFRfVkVSVF9TSEFERVIsIFxuXHRcdFx0XHRTcHJpdGVCYXRjaC5ERUZBVUxUX0ZSQUdfU0hBREVSKTtcblx0XHRpZiAoc2hhZGVyLmxvZylcblx0XHRcdGNvbnNvbGUud2FybihcIlNoYWRlciBMb2c6XFxuXCIgKyBzaGFkZXIubG9nKTtcblx0XHRyZXR1cm4gc2hhZGVyO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBUaGlzIGlzIGNhbGxlZCBkdXJpbmcgcmVuZGVyaW5nIHRvIHVwZGF0ZSBwcm9qZWN0aW9uL3RyYW5zZm9ybVxuXHQgKiBtYXRyaWNlcyBhbmQgdXBsb2FkIHRoZSBuZXcgdmFsdWVzIHRvIHRoZSBzaGFkZXIuIEZvciBleGFtcGxlLFxuXHQgKiBpZiB0aGUgdXNlciBjYWxscyBzZXRQcm9qZWN0aW9uIG1pZC1kcmF3LCB0aGUgYmF0Y2ggd2lsbCBmbHVzaFxuXHQgKiBhbmQgdGhpcyB3aWxsIGJlIGNhbGxlZCBiZWZvcmUgY29udGludWluZyB0byBhZGQgaXRlbXMgdG8gdGhlIGJhdGNoLlxuXHQgKlxuXHQgKiBZb3UgZ2VuZXJhbGx5IHNob3VsZCBub3QgbmVlZCB0byBjYWxsIHRoaXMgZGlyZWN0bHkuXG5cdCAqIFxuXHQgKiBAbWV0aG9kICB1cGRhdGVNYXRyaWNlc1xuXHQgKiBAcHJvdGVjdGVkXG5cdCAqL1xuXHR1cGRhdGVNYXRyaWNlczogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5zaGFkZXIuc2V0VW5pZm9ybWZ2KFwidV9wcm9qZWN0aW9uXCIsIHRoaXMucHJvamVjdGlvbik7XG5cdH0sXG5cblx0LyoqXG5cdCAqIENhbGxlZCBiZWZvcmUgcmVuZGVyaW5nLCBhbmQgYmluZHMgdGhlIGN1cnJlbnQgdGV4dHVyZS5cblx0ICogXG5cdCAqIEBtZXRob2QgX3ByZVJlbmRlclxuXHQgKiBAcHJvdGVjdGVkXG5cdCAqL1xuXHRfcHJlUmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHRpZiAodGhpcy50ZXh0dXJlKVxuXHRcdFx0dGhpcy50ZXh0dXJlLmJpbmQoKTtcblx0fSxcblxuXHQvKipcblx0ICogQmluZHMgdGhlIHNoYWRlciwgZGlzYWJsZXMgZGVwdGggd3JpdGluZywgXG5cdCAqIGVuYWJsZXMgYmxlbmRpbmcsIGFjdGl2YXRlcyB0ZXh0dXJlIHVuaXQgMCwgYW5kIHNlbmRzXG5cdCAqIGRlZmF1bHQgbWF0cmljZXMgYW5kIHNhbXBsZXIyRCB1bmlmb3JtcyB0byB0aGUgc2hhZGVyLlxuXHQgKlxuXHQgKiBAbWV0aG9kICBiZWdpblxuXHQgKi9cblx0YmVnaW46IGZ1bmN0aW9uKCkge1xuXHRcdC8vc3ByaXRlIGJhdGNoIGRvZXNuJ3QgaG9sZCBhIHJlZmVyZW5jZSB0byBHTCBzaW5jZSBpdCBpcyB2b2xhdGlsZVxuXHRcdHZhciBnbCA9IHRoaXMuY29udGV4dC5nbDtcblx0XHRcblx0XHQvL1RoaXMgYmluZHMgdGhlIHNoYWRlciBhbmQgbWVzaCFcblx0XHRCYXNlQmF0Y2gucHJvdG90eXBlLmJlZ2luLmNhbGwodGhpcyk7XG5cblx0XHR0aGlzLnVwZGF0ZU1hdHJpY2VzKCk7IC8vc2VuZCBwcm9qZWN0aW9uL3RyYW5zZm9ybSB0byBzaGFkZXJcblxuXHRcdC8vdXBsb2FkIHRoZSBzYW1wbGVyIHVuaWZvcm0uIG5vdCBuZWNlc3NhcnkgZXZlcnkgZmx1c2ggc28gd2UganVzdFxuXHRcdC8vZG8gaXQgaGVyZS5cblx0XHR0aGlzLnNoYWRlci5zZXRVbmlmb3JtaShcInVfdGV4dHVyZTBcIiwgMCk7XG5cblx0XHQvL2Rpc2FibGUgZGVwdGggbWFza1xuXHRcdGdsLmRlcHRoTWFzayhmYWxzZSk7XG5cblx0XHQvL3ByZW11bHRpcGxpZWQgYWxwaGFcblx0XHRpZiAodGhpcy5fYmxlbmRFbmFibGVkKSB7XG5cdFx0XHRnbC5lbmFibGUoZ2wuQkxFTkQpO1xuXG5cdFx0XHQvL3NldCBlaXRoZXIgdG8gLTEgaWYgeW91IHdhbnQgdG8gY2FsbCB5b3VyIG93biBcblx0XHRcdC8vYmxlbmRGdW5jIG9yIGJsZW5kRnVuY1NlcGFyYXRlXG5cdFx0XHRpZiAodGhpcy5fYmxlbmRTcmMgIT09IC0xICYmIHRoaXMuX2JsZW5kRHN0ICE9PSAtMSlcblx0XHRcdFx0Z2wuYmxlbmRGdW5jKHRoaXMuX2JsZW5kU3JjLCB0aGlzLl9ibGVuZERzdCk7IFxuXHRcdH1cblx0fSxcblxuXHQvKipcblx0ICogRW5kcyB0aGUgc3ByaXRlIGJhdGNoZXIgYW5kIGZsdXNoZXMgYW55IHJlbWFpbmluZyBkYXRhIHRvIHRoZSBHUFUuXG5cdCAqIFxuXHQgKiBAbWV0aG9kIGVuZFxuXHQgKi9cblx0ZW5kOiBmdW5jdGlvbigpIHtcblx0XHQvL3Nwcml0ZSBiYXRjaCBkb2Vzbid0IGhvbGQgYSByZWZlcmVuY2UgdG8gR0wgc2luY2UgaXQgaXMgdm9sYXRpbGVcblx0XHR2YXIgZ2wgPSB0aGlzLmNvbnRleHQuZ2w7XG5cdFx0XG5cdFx0Ly9qdXN0IGRvIGRpcmVjdCBwYXJlbnQgY2FsbCBmb3Igc3BlZWQgaGVyZVxuXHRcdC8vVGhpcyBiaW5kcyB0aGUgc2hhZGVyIGFuZCBtZXNoIVxuXHRcdEJhc2VCYXRjaC5wcm90b3R5cGUuZW5kLmNhbGwodGhpcyk7XG5cblx0XHRnbC5kZXB0aE1hc2sodHJ1ZSk7XG5cblx0XHRpZiAodGhpcy5fYmxlbmRFbmFibGVkKVxuXHRcdFx0Z2wuZGlzYWJsZShnbC5CTEVORCk7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEZsdXNoZXMgdGhlIGJhdGNoIHRvIHRoZSBHUFUuIFRoaXMgc2hvdWxkIGJlIGNhbGxlZCB3aGVuXG5cdCAqIHN0YXRlIGNoYW5nZXMsIHN1Y2ggYXMgYmxlbmQgZnVuY3Rpb25zLCBkZXB0aCBvciBzdGVuY2lsIHN0YXRlcyxcblx0ICogc2hhZGVycywgYW5kIHNvIGZvcnRoLlxuXHQgKiBcblx0ICogQG1ldGhvZCBmbHVzaFxuXHQgKi9cblx0Zmx1c2g6IGZ1bmN0aW9uKCkge1xuXHRcdC8vaWdub3JlIGZsdXNoIGlmIHRleHR1cmUgaXMgbnVsbCBvciBvdXIgYmF0Y2ggaXMgZW1wdHlcblx0XHRpZiAoIXRoaXMudGV4dHVyZSlcblx0XHRcdHJldHVybjtcblx0XHRpZiAodGhpcy5pZHggPT09IDApXG5cdFx0XHRyZXR1cm47XG5cdFx0QmFzZUJhdGNoLnByb3RvdHlwZS5mbHVzaC5jYWxsKHRoaXMpO1xuXHRcdFNwcml0ZUJhdGNoLnRvdGFsUmVuZGVyQ2FsbHMrKztcblx0fSxcblxuXHQvKipcblx0ICogQWRkcyBhIHNwcml0ZSB0byB0aGlzIGJhdGNoLiBUaGUgc3ByaXRlIGlzIGRyYXduIGluIFxuXHQgKiBzY3JlZW4tc3BhY2Ugd2l0aCB0aGUgb3JpZ2luIGF0IHRoZSB1cHBlci1sZWZ0IGNvcm5lciAoeS1kb3duKS5cblx0ICogXG5cdCAqIEBtZXRob2QgZHJhd1xuXHQgKiBAcGFyYW0gIHtUZXh0dXJlfSB0ZXh0dXJlIHRoZSBUZXh0dXJlXG5cdCAqIEBwYXJhbSAge051bWJlcn0geCAgICAgICB0aGUgeCBwb3NpdGlvbiBpbiBwaXhlbHMsIGRlZmF1bHRzIHRvIHplcm9cblx0ICogQHBhcmFtICB7TnVtYmVyfSB5ICAgICAgIHRoZSB5IHBvc2l0aW9uIGluIHBpeGVscywgZGVmYXVsdHMgdG8gemVyb1xuXHQgKiBAcGFyYW0gIHtOdW1iZXJ9IHdpZHRoICAgdGhlIHdpZHRoIGluIHBpeGVscywgZGVmYXVsdHMgdG8gdGhlIHRleHR1cmUgd2lkdGhcblx0ICogQHBhcmFtICB7TnVtYmVyfSBoZWlnaHQgIHRoZSBoZWlnaHQgaW4gcGl4ZWxzLCBkZWZhdWx0cyB0byB0aGUgdGV4dHVyZSBoZWlnaHRcblx0ICogQHBhcmFtICB7TnVtYmVyfSB1MSAgICAgIHRoZSBmaXJzdCBVIGNvb3JkaW5hdGUsIGRlZmF1bHQgemVyb1xuXHQgKiBAcGFyYW0gIHtOdW1iZXJ9IHYxICAgICAgdGhlIGZpcnN0IFYgY29vcmRpbmF0ZSwgZGVmYXVsdCB6ZXJvXG5cdCAqIEBwYXJhbSAge051bWJlcn0gdTIgICAgICB0aGUgc2Vjb25kIFUgY29vcmRpbmF0ZSwgZGVmYXVsdCBvbmVcblx0ICogQHBhcmFtICB7TnVtYmVyfSB2MiAgICAgIHRoZSBzZWNvbmQgViBjb29yZGluYXRlLCBkZWZhdWx0IG9uZVxuXHQgKi9cblx0ZHJhdzogZnVuY3Rpb24odGV4dHVyZSwgeCwgeSwgd2lkdGgsIGhlaWdodCwgdTEsIHYxLCB1MiwgdjIpIHtcblx0XHRpZiAoIXRoaXMuZHJhd2luZylcblx0XHRcdHRocm93IFwiSWxsZWdhbCBTdGF0ZTogdHJ5aW5nIHRvIGRyYXcgYSBiYXRjaCBiZWZvcmUgYmVnaW4oKVwiO1xuXG5cdFx0Ly9kb24ndCBkcmF3IGFueXRoaW5nIGlmIEdMIHRleCBkb2Vzbid0IGV4aXN0Li5cblx0XHRpZiAoIXRleHR1cmUpXG5cdFx0XHRyZXR1cm47XG5cblx0XHRpZiAodGhpcy50ZXh0dXJlID09PSBudWxsIHx8IHRoaXMudGV4dHVyZS5pZCAhPT0gdGV4dHVyZS5pZCkge1xuXHRcdFx0Ly9uZXcgdGV4dHVyZS4uIGZsdXNoIHByZXZpb3VzIGRhdGFcblx0XHRcdHRoaXMuZmx1c2goKTtcblx0XHRcdHRoaXMudGV4dHVyZSA9IHRleHR1cmU7XG5cdFx0fSBlbHNlIGlmICh0aGlzLmlkeCA9PSB0aGlzLnZlcnRpY2VzLmxlbmd0aCkge1xuXHRcdFx0dGhpcy5mbHVzaCgpOyAvL3dlJ3ZlIHJlYWNoZWQgb3VyIG1heCwgZmx1c2ggYmVmb3JlIHB1c2hpbmcgbW9yZSBkYXRhXG5cdFx0fVxuXG5cdFx0d2lkdGggPSAod2lkdGg9PT0wKSA/IHdpZHRoIDogKHdpZHRoIHx8IHRleHR1cmUud2lkdGgpO1xuXHRcdGhlaWdodCA9IChoZWlnaHQ9PT0wKSA/IGhlaWdodCA6IChoZWlnaHQgfHwgdGV4dHVyZS5oZWlnaHQpO1xuXHRcdHggPSB4IHx8IDA7XG5cdFx0eSA9IHkgfHwgMDtcblxuXHRcdHZhciB4MSA9IHg7XG5cdFx0dmFyIHgyID0geCArIHdpZHRoO1xuXHRcdHZhciB5MSA9IHk7XG5cdFx0dmFyIHkyID0geSArIGhlaWdodDtcblxuXHRcdHUxID0gdTEgfHwgMDtcblx0XHR1MiA9ICh1Mj09PTApID8gdTIgOiAodTIgfHwgMSk7XG5cdFx0djEgPSB2MSB8fCAwO1xuXHRcdHYyID0gKHYyPT09MCkgPyB2MiA6ICh2MiB8fCAxKTtcblxuXHRcdHZhciBjID0gdGhpcy5jb2xvcjtcblxuXHRcdC8veHlcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0geDE7XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHkxO1xuXHRcdC8vY29sb3Jcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0gYztcblx0XHQvL3V2XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHUxO1xuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB2MTtcblx0XHRcblx0XHQvL3h5XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHgyO1xuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB5MTtcblx0XHQvL2NvbG9yXG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IGM7XG5cdFx0Ly91dlxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB1Mjtcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0gdjE7XG5cblx0XHQvL3h5XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHgyO1xuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB5Mjtcblx0XHQvL2NvbG9yXG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IGM7XG5cdFx0Ly91dlxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB1Mjtcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0gdjI7XG5cblx0XHQvL3h5XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHgxO1xuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB5Mjtcblx0XHQvL2NvbG9yXG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IGM7XG5cdFx0Ly91dlxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB1MTtcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0gdjI7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEFkZHMgYSBzaW5nbGUgcXVhZCBtZXNoIHRvIHRoaXMgc3ByaXRlIGJhdGNoIGZyb20gdGhlIGdpdmVuXG5cdCAqIGFycmF5IG9mIHZlcnRpY2VzLiBUaGUgc3ByaXRlIGlzIGRyYXduIGluIFxuXHQgKiBzY3JlZW4tc3BhY2Ugd2l0aCB0aGUgb3JpZ2luIGF0IHRoZSB1cHBlci1sZWZ0IGNvcm5lciAoeS1kb3duKS5cblx0ICpcblx0ICogVGhpcyByZWFkcyAyMCBpbnRlcmxlYXZlZCBmbG9hdHMgZnJvbSB0aGUgZ2l2ZW4gb2Zmc2V0IGluZGV4LCBpbiB0aGUgZm9ybWF0XG5cdCAqXG5cdCAqICB7IHgsIHksIGNvbG9yLCB1LCB2LFxuXHQgKiAgICAgIC4uLiAgfVxuXHQgKlxuXHQgKiBAbWV0aG9kICBkcmF3VmVydGljZXNcblx0ICogQHBhcmFtIHtUZXh0dXJlfSB0ZXh0dXJlIHRoZSBUZXh0dXJlIG9iamVjdFxuXHQgKiBAcGFyYW0ge0Zsb2F0MzJBcnJheX0gdmVydHMgYW4gYXJyYXkgb2YgdmVydGljZXNcblx0ICogQHBhcmFtIHtOdW1iZXJ9IG9mZiB0aGUgb2Zmc2V0IGludG8gdGhlIHZlcnRpY2VzIGFycmF5IHRvIHJlYWQgZnJvbVxuXHQgKi9cblx0ZHJhd1ZlcnRpY2VzOiBmdW5jdGlvbih0ZXh0dXJlLCB2ZXJ0cywgb2ZmKSB7XG5cdFx0aWYgKCF0aGlzLmRyYXdpbmcpXG5cdFx0XHR0aHJvdyBcIklsbGVnYWwgU3RhdGU6IHRyeWluZyB0byBkcmF3IGEgYmF0Y2ggYmVmb3JlIGJlZ2luKClcIjtcblx0XHRcblx0XHQvL2Rvbid0IGRyYXcgYW55dGhpbmcgaWYgR0wgdGV4IGRvZXNuJ3QgZXhpc3QuLlxuXHRcdGlmICghdGV4dHVyZSlcblx0XHRcdHJldHVybjtcblxuXG5cdFx0aWYgKHRoaXMudGV4dHVyZSAhPSB0ZXh0dXJlKSB7XG5cdFx0XHQvL25ldyB0ZXh0dXJlLi4gZmx1c2ggcHJldmlvdXMgZGF0YVxuXHRcdFx0dGhpcy5mbHVzaCgpO1xuXHRcdFx0dGhpcy50ZXh0dXJlID0gdGV4dHVyZTtcblx0XHR9IGVsc2UgaWYgKHRoaXMuaWR4ID09IHRoaXMudmVydGljZXMubGVuZ3RoKSB7XG5cdFx0XHR0aGlzLmZsdXNoKCk7IC8vd2UndmUgcmVhY2hlZCBvdXIgbWF4LCBmbHVzaCBiZWZvcmUgcHVzaGluZyBtb3JlIGRhdGFcblx0XHR9XG5cblx0XHRvZmYgPSBvZmYgfHwgMDtcblx0XHQvL1RPRE86IHVzZSBhIGxvb3AgaGVyZT9cblx0XHQvL3h5XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHZlcnRzW29mZisrXTtcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0gdmVydHNbb2ZmKytdO1xuXHRcdC8vY29sb3Jcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0gdmVydHNbb2ZmKytdO1xuXHRcdC8vdXZcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0gdmVydHNbb2ZmKytdO1xuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB2ZXJ0c1tvZmYrK107XG5cdFx0XG5cdFx0Ly94eVxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB2ZXJ0c1tvZmYrK107XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHZlcnRzW29mZisrXTtcblx0XHQvL2NvbG9yXG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHZlcnRzW29mZisrXTtcblx0XHQvL3V2XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHZlcnRzW29mZisrXTtcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0gdmVydHNbb2ZmKytdO1xuXG5cdFx0Ly94eVxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB2ZXJ0c1tvZmYrK107XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHZlcnRzW29mZisrXTtcblx0XHQvL2NvbG9yXG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHZlcnRzW29mZisrXTtcblx0XHQvL3V2XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHZlcnRzW29mZisrXTtcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0gdmVydHNbb2ZmKytdO1xuXG5cdFx0Ly94eVxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB2ZXJ0c1tvZmYrK107XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHZlcnRzW29mZisrXTtcblx0XHQvL2NvbG9yXG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHZlcnRzW29mZisrXTtcblx0XHQvL3V2XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHZlcnRzW29mZisrXTtcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0gdmVydHNbb2ZmKytdO1xuXHR9XG59KTtcblxuLyoqXG4gKiBUaGUgZGVmYXVsdCB2ZXJ0ZXggc2l6ZSwgaS5lLiBudW1iZXIgb2YgZmxvYXRzIHBlciB2ZXJ0ZXguXG4gKiBAYXR0cmlidXRlICBWRVJURVhfU0laRVxuICogQHN0YXRpY1xuICogQGZpbmFsXG4gKiBAdHlwZSB7TnVtYmVyfVxuICogQGRlZmF1bHQgIDVcbiAqL1xuU3ByaXRlQmF0Y2guVkVSVEVYX1NJWkUgPSA1O1xuXG4vKipcbiAqIEluY3JlbWVudGVkIGFmdGVyIGVhY2ggZHJhdyBjYWxsLCBjYW4gYmUgdXNlZCBmb3IgZGVidWdnaW5nLlxuICpcbiAqICAgICBTcHJpdGVCYXRjaC50b3RhbFJlbmRlckNhbGxzID0gMDtcbiAqXG4gKiAgICAgLi4uIGRyYXcgeW91ciBzY2VuZSAuLi5cbiAqXG4gKiAgICAgY29uc29sZS5sb2coXCJEcmF3IGNhbGxzIHBlciBmcmFtZTpcIiwgU3ByaXRlQmF0Y2gudG90YWxSZW5kZXJDYWxscyk7XG4gKlxuICogXG4gKiBAYXR0cmlidXRlICB0b3RhbFJlbmRlckNhbGxzXG4gKiBAc3RhdGljXG4gKiBAdHlwZSB7TnVtYmVyfVxuICogQGRlZmF1bHQgIDBcbiAqL1xuU3ByaXRlQmF0Y2gudG90YWxSZW5kZXJDYWxscyA9IDA7XG5cblNwcml0ZUJhdGNoLkRFRkFVTFRfRlJBR19TSEFERVIgPSBbXG5cdFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XCIsXG5cdFwidmFyeWluZyB2ZWMyIHZUZXhDb29yZDA7XCIsXG5cdFwidmFyeWluZyB2ZWM0IHZDb2xvcjtcIixcblx0XCJ1bmlmb3JtIHNhbXBsZXIyRCB1X3RleHR1cmUwO1wiLFxuXG5cdFwidm9pZCBtYWluKHZvaWQpIHtcIixcblx0XCIgICBnbF9GcmFnQ29sb3IgPSB0ZXh0dXJlMkQodV90ZXh0dXJlMCwgdlRleENvb3JkMCkgKiB2Q29sb3I7XCIsXG5cdFwifVwiXG5dLmpvaW4oJ1xcbicpO1xuXG5TcHJpdGVCYXRjaC5ERUZBVUxUX1ZFUlRfU0hBREVSID0gW1xuXHRcImF0dHJpYnV0ZSB2ZWMyIFBvc2l0aW9uO1wiLFxuXHRcImF0dHJpYnV0ZSB2ZWM0IENvbG9yO1wiLFxuXHRcImF0dHJpYnV0ZSB2ZWMyIFRleENvb3JkMDtcIixcblxuXHRcInVuaWZvcm0gdmVjMiB1X3Byb2plY3Rpb247XCIsXG5cdFwidmFyeWluZyB2ZWMyIHZUZXhDb29yZDA7XCIsXG5cdFwidmFyeWluZyB2ZWM0IHZDb2xvcjtcIixcblxuXHRcInZvaWQgbWFpbih2b2lkKSB7XCIsXG5cdFwiICAgZ2xfUG9zaXRpb24gPSB2ZWM0KCBQb3NpdGlvbi54IC8gdV9wcm9qZWN0aW9uLnggLSAxLjAsIFBvc2l0aW9uLnkgLyAtdV9wcm9qZWN0aW9uLnkgKyAxLjAgLCAwLjAsIDEuMCk7XCIsXG5cdFwiICAgdlRleENvb3JkMCA9IFRleENvb3JkMDtcIixcblx0XCIgICB2Q29sb3IgPSBDb2xvcjtcIixcblx0XCJ9XCJcbl0uam9pbignXFxuJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gU3ByaXRlQmF0Y2g7XG4iLCIvKipcbiAqIEBtb2R1bGUga2FtaVxuICovXG5cbnZhciBDbGFzcyA9IHJlcXVpcmUoJ2tsYXNzZScpO1xudmFyIFNpZ25hbCA9IHJlcXVpcmUoJ3NpZ25hbHMnKTtcbnZhciBuZXh0UG93ZXJPZlR3byA9IHJlcXVpcmUoJ251bWJlci11dGlsJykubmV4dFBvd2VyT2ZUd287XG52YXIgaXNQb3dlck9mVHdvID0gcmVxdWlyZSgnbnVtYmVyLXV0aWwnKS5pc1Bvd2VyT2ZUd287XG5cbnZhciBUZXh0dXJlID0gbmV3IENsYXNzKHtcblxuXG5cdC8qKlxuXHQgKiBDcmVhdGVzIGEgbmV3IHRleHR1cmUgd2l0aCB0aGUgb3B0aW9uYWwgd2lkdGgsIGhlaWdodCwgYW5kIGRhdGEuXG5cdCAqXG5cdCAqIElmIHRoZSBjb25zdHJ1Y3RvciBpcyBwYXNzZWQgbm8gcGFyYW1ldGVycyBvdGhlciB0aGFuIFdlYkdMQ29udGV4dCwgdGhlblxuXHQgKiBpdCB3aWxsIG5vdCBiZSBpbml0aWFsaXplZCBhbmQgd2lsbCBiZSBub24tcmVuZGVyYWJsZS4gWW91IHdpbGwgbmVlZCB0byBtYW51YWxseVxuXHQgKiB1cGxvYWREYXRhIG9yIHVwbG9hZEltYWdlIHlvdXJzZWxmLlxuXHQgKlxuXHQgKiBJZiB5b3UgcGFzcyBhIHdpZHRoIGFuZCBoZWlnaHQgYWZ0ZXIgY29udGV4dCwgdGhlIHRleHR1cmUgd2lsbCBiZSBpbml0aWFsaXplZCB3aXRoIHRoYXQgc2l6ZVxuXHQgKiBhbmQgbnVsbCBkYXRhIChlLmcuIHRyYW5zcGFyZW50IGJsYWNrKS4gSWYgeW91IGFsc28gcGFzcyB0aGUgZm9ybWF0IGFuZCBkYXRhLCBcblx0ICogaXQgd2lsbCBiZSB1cGxvYWRlZCB0byB0aGUgdGV4dHVyZS4gXG5cdCAqXG5cdCAqIElmIHlvdSBwYXNzIGEgU3RyaW5nIG9yIERhdGEgVVJJIGFzIHRoZSBzZWNvbmQgcGFyYW1ldGVyLFxuXHQgKiB0aGlzIFRleHR1cmUgd2lsbCBsb2FkIGFuIEltYWdlIG9iamVjdCBhc3luY2hyb25vdXNseS4gVGhlIG9wdGlvbmFsIHRoaXJkXG5cdCAqIGFuZCBmb3VydGggcGFyYW1ldGVycyBhcmUgY2FsbGJhY2sgZnVuY3Rpb25zIGZvciBzdWNjZXNzIGFuZCBmYWlsdXJlLCByZXNwZWN0aXZlbHkuIFxuXHQgKiBUaGUgb3B0aW9uYWwgZmlmcnRoIHBhcmFtZXRlciBmb3IgdGhpcyB2ZXJzaW9uIG9mIHRoZSBjb25zdHJ1Y3RvciBpcyBnZW5NaXBtYXBzLCB3aGljaCBkZWZhdWx0cyB0byBmYWxzZS4gXG5cdCAqIFxuXHQgKiBfTm90ZTpfIFRvIGF2b2lkIFdlYkdMIGVycm9ycyB3aXRoIHRoZSBJbWFnZSBVUkwgY29uc3RydWN0b3IsXG5cdCAqIHdlIHVwbG9hZCBhIGR1bW15IDF4MSB0cmFuc3BhcmVudCB0ZXh0dXJlIHVudGlsIHRoZSBhc3luYyBJbWFnZSBsb2FkIGhhcyBiZWVuIGNvbXBsZXRlZC4gU29cblx0ICogdGhlIHdpZHRoIGFuZCBoZWlnaHQgd2lsbCBub3QgYmUgYWNjdXJhdGUgdW50aWwgdGhlIG9uQ29tcGxldGUgY2FsbGJhY2sgaXMgZmlyZWQuXG5cdCAqIFxuXHQgKiBUaGUgYXJndW1lbnRzIGFyZSBrZXB0IGluIG1lbW9yeSBmb3IgZnV0dXJlIGNvbnRleHQgcmVzdG9yYXRpb24gZXZlbnRzLiBJZlxuXHQgKiB0aGlzIGlzIHVuZGVzaXJhYmxlIChlLmcuIGh1Z2UgYnVmZmVycyB3aGljaCBuZWVkIHRvIGJlIEdDJ2QpLCB5b3Ugc2hvdWxkIG5vdFxuXHQgKiBwYXNzIHRoZSBkYXRhIGluIHRoZSBjb25zdHJ1Y3RvciwgYnV0IGluc3RlYWQgdXBsb2FkIGl0IGFmdGVyIGNyZWF0aW5nIGFuIHVuaW5pdGlhbGl6ZWQgXG5cdCAqIHRleHR1cmUuIFlvdSB3aWxsIG5lZWQgdG8gbWFuYWdlIGl0IHlvdXJzZWxmLCBlaXRoZXIgYnkgZXh0ZW5kaW5nIHRoZSBjcmVhdGUoKSBtZXRob2QsIFxuXHQgKiBvciBsaXN0ZW5pbmcgdG8gcmVzdG9yZWQgZXZlbnRzIGluIFdlYkdMQ29udGV4dC5cblx0ICpcblx0ICogTW9zdCB1c2VycyB3aWxsIHdhbnQgdG8gdXNlIHRoZSBBc3NldE1hbmFnZXIgdG8gY3JlYXRlIGFuZCBtYW5hZ2UgdGhlaXIgdGV4dHVyZXNcblx0ICogd2l0aCBhc3luY2hyb25vdXMgbG9hZGluZyBhbmQgY29udGV4dCBsb3NzLiBcblx0ICpcblx0ICogQGV4YW1wbGVcblx0ICogXHRcdG5ldyBUZXh0dXJlKGNvbnRleHQsIDI1NiwgMjU2KTsgLy9lbXB0eSAyNTZ4MjU2IHRleHR1cmVcblx0ICogXHRcdG5ldyBUZXh0dXJlKGNvbnRleHQsIDEsIDEsIFRleHR1cmUuRm9ybWF0LlJHQkEsIFRleHR1cmUuRGF0YVR5cGUuVU5TSUdORURfQllURSwgXG5cdCAqIFx0XHRcdFx0XHRuZXcgVWludDhBcnJheShbMjU1LDAsMCwyNTVdKSk7IC8vMXgxIHJlZCB0ZXh0dXJlXG5cdCAqIFx0XHRuZXcgVGV4dHVyZShcInRlc3QucG5nXCIpOyAvL2xvYWRzIGltYWdlIGFzeW5jaHJvbm91c2x5XG5cdCAqIFx0XHRuZXcgVGV4dHVyZShcInRlc3QucG5nXCIsIHN1Y2Nlc3NGdW5jLCBmYWlsRnVuYywgdXNlTWlwbWFwcyk7IC8vZXh0cmEgcGFyYW1zIGZvciBpbWFnZSBsYW9kZXIgXG5cdCAqXG5cdCAqIEBjbGFzcyAgVGV4dHVyZVxuXHQgKiBAY29uc3RydWN0b3Jcblx0ICogQHBhcmFtICB7V2ViR0xDb250ZXh0fSBjb250ZXh0IHRoZSBXZWJHTCBjb250ZXh0XG5cdCAqIEBwYXJhbSAge051bWJlcn0gd2lkdGggdGhlIHdpZHRoIG9mIHRoaXMgdGV4dHVyZVxuXHQgKiBAcGFyYW0gIHtOdW1iZXJ9IGhlaWdodCB0aGUgaGVpZ2h0IG9mIHRoaXMgdGV4dHVyZVxuXHQgKiBAcGFyYW0gIHtHTGVudW19IGZvcm1hdCBlLmcuIFRleHR1cmUuRm9ybWF0LlJHQkFcblx0ICogQHBhcmFtICB7R0xlbnVtfSBkYXRhVHlwZSBlLmcuIFRleHR1cmUuRGF0YVR5cGUuVU5TSUdORURfQllURSAoVWludDhBcnJheSlcblx0ICogQHBhcmFtICB7R0xlbnVtfSBkYXRhIHRoZSBhcnJheSBidWZmZXIsIGUuZy4gYSBVaW50OEFycmF5IHZpZXdcblx0ICogQHBhcmFtICB7Qm9vbGVhbn0gZ2VuTWlwbWFwcyB3aGV0aGVyIHRvIGdlbmVyYXRlIG1pcG1hcHMgYWZ0ZXIgdXBsb2FkaW5nIHRoZSBkYXRhXG5cdCAqL1xuXHRpbml0aWFsaXplOiBmdW5jdGlvbiBUZXh0dXJlKGNvbnRleHQsIHdpZHRoLCBoZWlnaHQsIGZvcm1hdCwgZGF0YVR5cGUsIGRhdGEsIGdlbk1pcG1hcHMpIHtcblx0XHRpZiAodHlwZW9mIGNvbnRleHQgIT09IFwib2JqZWN0XCIpXG5cdFx0XHR0aHJvdyBcIkdMIGNvbnRleHQgbm90IHNwZWNpZmllZCB0byBUZXh0dXJlXCI7XG5cdFx0dGhpcy5jb250ZXh0ID0gY29udGV4dDtcblxuXHRcdC8qKlxuXHRcdCAqIFRoZSBXZWJHTFRleHR1cmUgd2hpY2ggYmFja3MgdGhpcyBUZXh0dXJlIG9iamVjdC4gVGhpc1xuXHRcdCAqIGNhbiBiZSB1c2VkIGZvciBsb3ctbGV2ZWwgR0wgY2FsbHMuXG5cdFx0ICogXG5cdFx0ICogQHR5cGUge1dlYkdMVGV4dHVyZX1cblx0XHQgKi9cblx0XHR0aGlzLmlkID0gbnVsbDsgLy9pbml0aWFsaXplZCBpbiBjcmVhdGUoKVxuXG5cdFx0LyoqXG5cdFx0ICogVGhlIHRhcmdldCBmb3IgdGhpcyB0ZXh0dXJlIHVuaXQsIGkuZS4gVEVYVFVSRV8yRC4gU3ViY2xhc3Nlc1xuXHRcdCAqIHNob3VsZCBvdmVycmlkZSB0aGUgY3JlYXRlKCkgbWV0aG9kIHRvIGNoYW5nZSB0aGlzLCBmb3IgY29ycmVjdFxuXHRcdCAqIHVzYWdlIHdpdGggY29udGV4dCByZXN0b3JlLlxuXHRcdCAqIFxuXHRcdCAqIEBwcm9wZXJ0eSB0YXJnZXRcblx0XHQgKiBAdHlwZSB7R0xlbnVtfVxuXHRcdCAqIEBkZWZhdWx0ICBnbC5URVhUVVJFXzJEXG5cdFx0ICovXG5cdFx0dGhpcy50YXJnZXQgPSBudWxsOyAvL2luaXRpYWxpemVkIGluIGNyZWF0ZSgpXG5cblx0XHQvKipcblx0XHQgKiBUaGUgd2lkdGggb2YgdGhpcyB0ZXh0dXJlLCBpbiBwaXhlbHMuXG5cdFx0ICogXG5cdFx0ICogQHByb3BlcnR5IHdpZHRoXG5cdFx0ICogQHJlYWRPbmx5XG5cdFx0ICogQHR5cGUge051bWJlcn0gdGhlIHdpZHRoXG5cdFx0ICovXG5cdFx0dGhpcy53aWR0aCA9IDA7IC8vaW5pdGlhbGl6ZWQgb24gdGV4dHVyZSB1cGxvYWRcblxuXHRcdC8qKlxuXHRcdCAqIFRoZSBoZWlnaHQgb2YgdGhpcyB0ZXh0dXJlLCBpbiBwaXhlbHMuXG5cdFx0ICogXG5cdFx0ICogQHByb3BlcnR5IGhlaWdodFxuXHRcdCAqIEByZWFkT25seVxuXHRcdCAqIEB0eXBlIHtOdW1iZXJ9IHRoZSBoZWlnaHRcblx0XHQgKi9cblx0XHR0aGlzLmhlaWdodCA9IDA7IC8vaW5pdGlhbGl6ZWQgb24gdGV4dHVyZSB1cGxvYWRcblxuXHRcdC8vIGUuZy4gLS0+IG5ldyBUZXh0dXJlKGdsLCAyNTYsIDI1NiwgZ2wuUkdCLCBnbC5VTlNJR05FRF9CWVRFLCBkYXRhKTtcblx0XHQvL1x0XHQgICAgICBjcmVhdGVzIGEgbmV3IGVtcHR5IHRleHR1cmUsIDI1NngyNTZcblx0XHQvL1x0XHQtLT4gbmV3IFRleHR1cmUoZ2wpO1xuXHRcdC8vXHRcdFx0ICBjcmVhdGVzIGEgbmV3IHRleHR1cmUgYnV0IFdJVEhPVVQgdXBsb2FkaW5nIGFueSBkYXRhLiBcblxuXHRcdHRoaXMud3JhcFMgPSBUZXh0dXJlLkRFRkFVTFRfV1JBUDtcblx0XHR0aGlzLndyYXBUID0gVGV4dHVyZS5ERUZBVUxUX1dSQVA7XG5cdFx0dGhpcy5taW5GaWx0ZXIgPSBUZXh0dXJlLkRFRkFVTFRfRklMVEVSO1xuXHRcdHRoaXMubWFnRmlsdGVyID0gVGV4dHVyZS5ERUZBVUxUX0ZJTFRFUjtcblxuXHRcdC8qKlxuXHRcdCAqIFdoZW4gYSB0ZXh0dXJlIGlzIGNyZWF0ZWQsIHdlIGtlZXAgdHJhY2sgb2YgdGhlIGFyZ3VtZW50cyBwcm92aWRlZCB0byBcblx0XHQgKiBpdHMgY29uc3RydWN0b3IuIE9uIGNvbnRleHQgbG9zcyBhbmQgcmVzdG9yZSwgdGhlc2UgYXJndW1lbnRzIGFyZSByZS1zdXBwbGllZFxuXHRcdCAqIHRvIHRoZSBUZXh0dXJlLCBzbyBhcyB0byByZS1jcmVhdGUgaXQgaW4gaXRzIGNvcnJlY3QgZm9ybS5cblx0XHQgKlxuXHRcdCAqIFRoaXMgaXMgbWFpbmx5IHVzZWZ1bCBpZiB5b3UgYXJlIHByb2NlZHVyYWxseSBjcmVhdGluZyB0ZXh0dXJlcyBhbmQgcGFzc2luZ1xuXHRcdCAqIHRoZWlyIGRhdGEgZGlyZWN0bHkgKGUuZy4gZm9yIGdlbmVyaWMgbG9va3VwIHRhYmxlcyBpbiBhIHNoYWRlcikuIEZvciBpbWFnZVxuXHRcdCAqIG9yIG1lZGlhIGJhc2VkIHRleHR1cmVzLCBpdCB3b3VsZCBiZSBiZXR0ZXIgdG8gdXNlIGFuIEFzc2V0TWFuYWdlciB0byBtYW5hZ2Vcblx0XHQgKiB0aGUgYXN5bmNocm9ub3VzIHRleHR1cmUgdXBsb2FkLlxuXHRcdCAqXG5cdFx0ICogVXBvbiBkZXN0cm95aW5nIGEgdGV4dHVyZSwgYSByZWZlcmVuY2UgdG8gdGhpcyBpcyBhbHNvIGxvc3QuXG5cdFx0ICogXG5cdFx0ICogQHR5cGUge0FycmF5fSB0aGUgYXJyYXkgb2YgYXJndW1lbnRzLCBzaGlmdGVkIHRvIGV4Y2x1ZGUgdGhlIFdlYkdMQ29udGV4dCBwYXJhbWV0ZXJcblx0XHQgKi9cblx0XHR0aGlzLm1hbmFnZWRBcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcblxuXHRcdC8vVGhpcyBpcyBtYWFuZ2VkIGJ5IFdlYkdMQ29udGV4dFxuXHRcdHRoaXMuY29udGV4dC5hZGRNYW5hZ2VkT2JqZWN0KHRoaXMpO1xuXHRcdHRoaXMuY3JlYXRlKCk7XG5cdH0sXG5cblx0LyoqXG5cdCAqIE9uIGluc3RhbnRpYXRpb24gYW5kIHN1YnNlcXVlbnQgY29udGV4dCByZXN0b3JlLCB0aGlzIGZ1bmN0aW9uIGlzIGNhbGxlZFxuXHQgKiB0byBwYXJzZSB0aGUgY29uc3RydWN0b3IncyBhcmd1bWVudHMuXG5cdCAqIFxuXHQgKiBAcHJvdGVjdGVkXG5cdCAqL1xuXHRfaGFuZGxlQ3JlYXRlOiBmdW5jdGlvbih3aWR0aCwgaGVpZ2h0LCBmb3JtYXQsIGRhdGFUeXBlLCBkYXRhLCBnZW5NaXBtYXBzKSB7XG5cdFx0dmFyIGdsID0gdGhpcy5nbDtcblxuXHRcdC8vSWYgdGhlIGZpcnN0IGFyZ3VtZW50IGlzIGEgc3RyaW5nLCBhc3N1bWUgaXQncyBhbiBJbWFnZSBsb2FkZXJcblx0XHQvL3NlY29uZCBhcmd1bWVudCB3aWxsIHRoZW4gYmUgZ2VuTWlwbWFwcywgdGhpcmQgYW5kIGZvdXJ0aCB0aGUgc3VjY2Vzcy9mYWlsIGNhbGxiYWNrc1xuXHRcdGlmICh0eXBlb2Ygd2lkdGggPT09IFwic3RyaW5nXCIpIHtcblx0XHRcdHZhciBpbWcgPSBuZXcgSW1hZ2UoKTtcblx0XHRcdHZhciBwYXRoICAgICAgPSBhcmd1bWVudHNbMF07ICAgLy9maXJzdCBhcmd1bWVudCwgdGhlIHBhdGhcblx0XHRcdHZhciBzdWNjZXNzQ0IgPSB0eXBlb2YgYXJndW1lbnRzWzFdID09PSBcImZ1bmN0aW9uXCIgPyBhcmd1bWVudHNbMV0gOiBudWxsO1xuXHRcdFx0dmFyIGZhaWxDQiAgICA9IHR5cGVvZiBhcmd1bWVudHNbMl0gPT09IFwiZnVuY3Rpb25cIiA/IGFyZ3VtZW50c1syXSA6IG51bGw7XG5cdFx0XHRnZW5NaXBtYXBzICAgID0gISFhcmd1bWVudHNbM107XG5cblx0XHRcdHZhciBzZWxmID0gdGhpcztcblxuXHRcdFx0Ly9VbmZvcnR1bmF0ZWx5LCByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgZmlyZXMgYmVmb3JlIGltZy5vbmxvYWQgZXZlbnRzIGluIENocm9tZSwgZXZlblxuXHRcdFx0Ly9pZiB0aGUgaW1hZ2UgaXMgYWxyZWFkeSAnY29tcGxldGUnIChmcm9tIGNhY2hlKS4gU28gd2UgbmVlZCB0byB1cGxvYWQgMXgxXG5cdFx0XHQvL3RyYW5zcGFyZW50IGR1bW15IGRhdGEgdG8gZW5zdXJlIHRoYXQgdGhlIHVzZXIgaXNuJ3QgdHJ5aW5nIHRvIHJlbmRlciBcblx0XHRcdC8vYSBUZXh0dXJlIHRoYXQgaGFzbid0IGJlZW4gY3JlYXRlZCB5ZXQuXG5cdFx0XHRzZWxmLnVwbG9hZERhdGEoMSwgMSk7XG5cblx0XHRcdGltZy5vbmxvYWQgPSBmdW5jdGlvbigpIHtcblx0XHRcdFx0c2VsZi51cGxvYWRJbWFnZShpbWcsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBnZW5NaXBtYXBzKTtcblx0XHRcdFx0aWYgKHN1Y2Nlc3NDQilcblx0XHRcdFx0XHRzdWNjZXNzQ0IoKTtcblx0XHRcdH1cblx0XHRcdGltZy5vbmVycm9yID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdC8vIGNvbnNvbGUud2FybihcIkVycm9yIGxvYWRpbmcgaW1hZ2U6IFwiK3BhdGgpO1xuXHRcdFx0XHRpZiAoZ2VuTWlwbWFwcykgLy93ZSBnZW4gbWlwbWFwcyBvbiB0aGUgMXgxIGR1bW15XG5cdFx0XHRcdFx0Z2wuZ2VuZXJhdGVNaXBtYXAoZ2wuVEVYVFVSRV8yRCk7XG5cdFx0XHRcdGlmIChmYWlsQ0IpXG5cdFx0XHRcdFx0ZmFpbENCKCk7XG5cdFx0XHR9XG5cdFx0XHRpbWcub25hYm9ydCA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHQvLyBjb25zb2xlLndhcm4oXCJJbWFnZSBsb2FkIGFib3J0ZWQ6IFwiK3BhdGgpO1xuXHRcdFx0XHRpZiAoZ2VuTWlwbWFwcykgLy93ZSBnZW4gbWlwbWFwcyBvbiB0aGUgMXgxIGR1bW15XG5cdFx0XHRcdFx0Z2wuZ2VuZXJhdGVNaXBtYXAoZ2wuVEVYVFVSRV8yRCk7XG5cdFx0XHRcdGlmIChmYWlsQ0IpXG5cdFx0XHRcdFx0ZmFpbENCKCk7XG5cdFx0XHR9XG5cblx0XHRcdGltZy5zcmMgPSBwYXRoO1xuXHRcdH0gXG5cdFx0Ly9vdGhlcndpc2UgYXNzdW1lIG91ciByZWd1bGFyIGxpc3Qgb2Ygd2lkdGgvaGVpZ2h0IGFyZ3VtZW50cyBhcmUgcGFzc2VkXG5cdFx0ZWxzZSB7XG5cdFx0XHR0aGlzLnVwbG9hZERhdGEod2lkdGgsIGhlaWdodCwgZm9ybWF0LCBkYXRhVHlwZSwgZGF0YSwgZ2VuTWlwbWFwcyk7XG5cdFx0fVxuXHR9LFx0XG5cblx0LyoqXG5cdCAqIENhbGxlZCBpbiB0aGUgVGV4dHVyZSBjb25zdHJ1Y3RvciwgYW5kIGFmdGVyIHRoZSBHTCBjb250ZXh0IGhhcyBiZWVuIHJlLWluaXRpYWxpemVkLiBcblx0ICogU3ViY2xhc3NlcyBjYW4gb3ZlcnJpZGUgdGhpcyB0byBwcm92aWRlIGEgY3VzdG9tIGRhdGEgdXBsb2FkLCBlLmcuIGN1YmVtYXBzIG9yIGNvbXByZXNzZWRcblx0ICogdGV4dHVyZXMuXG5cdCAqL1xuXHRjcmVhdGU6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMuZ2wgPSB0aGlzLmNvbnRleHQuZ2w7IFxuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cblx0XHR0aGlzLmlkID0gZ2wuY3JlYXRlVGV4dHVyZSgpOyAvL3RleHR1cmUgSUQgaXMgcmVjcmVhdGVkXG5cdFx0dGhpcy53aWR0aCA9IHRoaXMuaGVpZ2h0ID0gMDsgLy9zaXplIGlzIHJlc2V0IHRvIHplcm8gdW50aWwgbG9hZGVkXG5cdFx0dGhpcy50YXJnZXQgPSBnbC5URVhUVVJFXzJEOyAgLy90aGUgcHJvdmlkZXIgY2FuIGNoYW5nZSB0aGlzIGlmIG5lY2Vzc2FyeSAoZS5nLiBjdWJlIG1hcHMpXG5cblx0XHR0aGlzLmJpbmQoKTtcblxuXG5cdFx0Ly9UT0RPOiBjbGVhbiB0aGVzZSB1cCBhIGxpdHRsZS4gXG5cdFx0Z2wucGl4ZWxTdG9yZWkoZ2wuVU5QQUNLX1BSRU1VTFRJUExZX0FMUEhBX1dFQkdMLCBUZXh0dXJlLlVOUEFDS19QUkVNVUxUSVBMWV9BTFBIQSk7XG5cdFx0Z2wucGl4ZWxTdG9yZWkoZ2wuVU5QQUNLX0FMSUdOTUVOVCwgVGV4dHVyZS5VTlBBQ0tfQUxJR05NRU5UKTtcblx0XHRnbC5waXhlbFN0b3JlaShnbC5VTlBBQ0tfRkxJUF9ZX1dFQkdMLCBUZXh0dXJlLlVOUEFDS19GTElQX1kpO1xuXHRcdFxuXHRcdHZhciBjb2xvcnNwYWNlID0gVGV4dHVyZS5VTlBBQ0tfQ09MT1JTUEFDRV9DT05WRVJTSU9OIHx8IGdsLkJST1dTRVJfREVGQVVMVF9XRUJHTDtcblx0XHRnbC5waXhlbFN0b3JlaShnbC5VTlBBQ0tfQ09MT1JTUEFDRV9DT05WRVJTSU9OX1dFQkdMLCBjb2xvcnNwYWNlKTtcblxuXHRcdC8vc2V0dXAgd3JhcCBtb2RlcyB3aXRob3V0IGJpbmRpbmcgcmVkdW5kYW50bHlcblx0XHR0aGlzLnNldFdyYXAodGhpcy53cmFwUywgdGhpcy53cmFwVCwgZmFsc2UpO1xuXHRcdHRoaXMuc2V0RmlsdGVyKHRoaXMubWluRmlsdGVyLCB0aGlzLm1hZ0ZpbHRlciwgZmFsc2UpO1xuXHRcdFxuXHRcdGlmICh0aGlzLm1hbmFnZWRBcmdzLmxlbmd0aCAhPT0gMCkge1xuXHRcdFx0dGhpcy5faGFuZGxlQ3JlYXRlLmFwcGx5KHRoaXMsIHRoaXMubWFuYWdlZEFyZ3MpO1xuXHRcdH1cblx0fSxcblxuXHQvKipcblx0ICogRGVzdHJveXMgdGhpcyB0ZXh0dXJlIGJ5IGRlbGV0aW5nIHRoZSBHTCByZXNvdXJjZSxcblx0ICogcmVtb3ZpbmcgaXQgZnJvbSB0aGUgV2ViR0xDb250ZXh0IG1hbmFnZW1lbnQgc3RhY2ssXG5cdCAqIHNldHRpbmcgaXRzIHNpemUgdG8gemVybywgYW5kIGlkIGFuZCBtYW5hZ2VkIGFyZ3VtZW50cyB0byBudWxsLlxuXHQgKiBcblx0ICogVHJ5aW5nIHRvIHVzZSB0aGlzIHRleHR1cmUgYWZ0ZXIgbWF5IGxlYWQgdG8gdW5kZWZpbmVkIGJlaGF2aW91ci5cblx0ICovXG5cdGRlc3Ryb3k6IGZ1bmN0aW9uKCkge1xuXHRcdGlmICh0aGlzLmlkICYmIHRoaXMuZ2wpXG5cdFx0XHR0aGlzLmdsLmRlbGV0ZVRleHR1cmUodGhpcy5pZCk7XG5cdFx0aWYgKHRoaXMuY29udGV4dClcblx0XHRcdHRoaXMuY29udGV4dC5yZW1vdmVNYW5hZ2VkT2JqZWN0KHRoaXMpO1xuXHRcdHRoaXMud2lkdGggPSB0aGlzLmhlaWdodCA9IDA7XG5cdFx0dGhpcy5pZCA9IG51bGw7XG5cdFx0dGhpcy5tYW5hZ2VkQXJncyA9IG51bGw7XG5cdFx0dGhpcy5jb250ZXh0ID0gbnVsbDtcblx0XHR0aGlzLmdsID0gbnVsbDtcblx0fSxcblxuXHQvKipcblx0ICogU2V0cyB0aGUgd3JhcCBtb2RlIGZvciB0aGlzIHRleHR1cmU7IGlmIHRoZSBzZWNvbmQgYXJndW1lbnRcblx0ICogaXMgdW5kZWZpbmVkIG9yIGZhbHN5LCB0aGVuIGJvdGggUyBhbmQgVCB3cmFwIHdpbGwgdXNlIHRoZSBmaXJzdFxuXHQgKiBhcmd1bWVudC5cblx0ICpcblx0ICogWW91IGNhbiB1c2UgVGV4dHVyZS5XcmFwIGNvbnN0YW50cyBmb3IgY29udmVuaWVuY2UsIHRvIGF2b2lkIG5lZWRpbmcgXG5cdCAqIGEgR0wgcmVmZXJlbmNlLlxuXHQgKlxuXHQgKiBAbWV0aG9kICBzZXRXcmFwXG5cdCAqIEBwYXJhbSB7R0xlbnVtfSBzIHRoZSBTIHdyYXAgbW9kZVxuXHQgKiBAcGFyYW0ge0dMZW51bX0gdCB0aGUgVCB3cmFwIG1vZGVcblx0ICogQHBhcmFtIHtCb29sZWFufSBpZ25vcmVCaW5kIChvcHRpb25hbCkgaWYgdHJ1ZSwgdGhlIGJpbmQgd2lsbCBiZSBpZ25vcmVkLiBcblx0ICovXG5cdHNldFdyYXA6IGZ1bmN0aW9uKHMsIHQsIGlnbm9yZUJpbmQpIHsgLy9UT0RPOiBzdXBwb3J0IFIgd3JhcCBtb2RlXG5cdFx0aWYgKHMgJiYgdCkge1xuXHRcdFx0dGhpcy53cmFwUyA9IHM7XG5cdFx0XHR0aGlzLndyYXBUID0gdDtcblx0XHR9IGVsc2UgXG5cdFx0XHR0aGlzLndyYXBTID0gdGhpcy53cmFwVCA9IHM7XG5cdFx0XG5cdFx0Ly9lbmZvcmNlIFBPVCBydWxlcy4uXG5cdFx0dGhpcy5fY2hlY2tQT1QoKTtcdFxuXG5cdFx0aWYgKCFpZ25vcmVCaW5kKVxuXHRcdFx0dGhpcy5iaW5kKCk7XG5cblx0XHR2YXIgZ2wgPSB0aGlzLmdsO1xuXHRcdGdsLnRleFBhcmFtZXRlcmkodGhpcy50YXJnZXQsIGdsLlRFWFRVUkVfV1JBUF9TLCB0aGlzLndyYXBTKTtcblx0XHRnbC50ZXhQYXJhbWV0ZXJpKHRoaXMudGFyZ2V0LCBnbC5URVhUVVJFX1dSQVBfVCwgdGhpcy53cmFwVCk7XG5cdH0sXG5cblxuXHQvKipcblx0ICogU2V0cyB0aGUgbWluIGFuZCBtYWcgZmlsdGVyIGZvciB0aGlzIHRleHR1cmU7IFxuXHQgKiBpZiBtYWcgaXMgdW5kZWZpbmVkIG9yIGZhbHN5LCB0aGVuIGJvdGggbWluIGFuZCBtYWcgd2lsbCB1c2UgdGhlXG5cdCAqIGZpbHRlciBzcGVjaWZpZWQgZm9yIG1pbi5cblx0ICpcblx0ICogWW91IGNhbiB1c2UgVGV4dHVyZS5GaWx0ZXIgY29uc3RhbnRzIGZvciBjb252ZW5pZW5jZSwgdG8gYXZvaWQgbmVlZGluZyBcblx0ICogYSBHTCByZWZlcmVuY2UuXG5cdCAqIFxuXHQgKiBAcGFyYW0ge0dMZW51bX0gbWluIHRoZSBtaW5pZmljYXRpb24gZmlsdGVyXG5cdCAqIEBwYXJhbSB7R0xlbnVtfSBtYWcgdGhlIG1hZ25pZmljYXRpb24gZmlsdGVyXG5cdCAqIEBwYXJhbSB7Qm9vbGVhbn0gaWdub3JlQmluZCBpZiB0cnVlLCB0aGUgYmluZCB3aWxsIGJlIGlnbm9yZWQuIFxuXHQgKi9cblx0c2V0RmlsdGVyOiBmdW5jdGlvbihtaW4sIG1hZywgaWdub3JlQmluZCkgeyBcblx0XHRpZiAobWluICYmIG1hZykge1xuXHRcdFx0dGhpcy5taW5GaWx0ZXIgPSBtaW47XG5cdFx0XHR0aGlzLm1hZ0ZpbHRlciA9IG1hZztcblx0XHR9IGVsc2UgXG5cdFx0XHR0aGlzLm1pbkZpbHRlciA9IHRoaXMubWFnRmlsdGVyID0gbWluO1xuXHRcdFxuXHRcdC8vZW5mb3JjZSBQT1QgcnVsZXMuLlxuXHRcdHRoaXMuX2NoZWNrUE9UKCk7XG5cblx0XHRpZiAoIWlnbm9yZUJpbmQpXG5cdFx0XHR0aGlzLmJpbmQoKTtcblxuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cdFx0Z2wudGV4UGFyYW1ldGVyaSh0aGlzLnRhcmdldCwgZ2wuVEVYVFVSRV9NSU5fRklMVEVSLCB0aGlzLm1pbkZpbHRlcik7XG5cdFx0Z2wudGV4UGFyYW1ldGVyaSh0aGlzLnRhcmdldCwgZ2wuVEVYVFVSRV9NQUdfRklMVEVSLCB0aGlzLm1hZ0ZpbHRlcik7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEEgbG93LWxldmVsIG1ldGhvZCB0byB1cGxvYWQgdGhlIHNwZWNpZmllZCBBcnJheUJ1ZmZlclZpZXdcblx0ICogdG8gdGhpcyB0ZXh0dXJlLiBUaGlzIHdpbGwgY2F1c2UgdGhlIHdpZHRoIGFuZCBoZWlnaHQgb2YgdGhpc1xuXHQgKiB0ZXh0dXJlIHRvIGNoYW5nZS5cblx0ICpcblx0ICogQG1ldGhvZCAgdXBsb2FkRGF0YVxuXHQgKiBAcGFyYW0gIHtOdW1iZXJ9IHdpZHRoICAgICAgICAgIHRoZSBuZXcgd2lkdGggb2YgdGhpcyB0ZXh0dXJlLFxuXHQgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlZmF1bHRzIHRvIHRoZSBsYXN0IHVzZWQgd2lkdGggKG9yIHplcm8pXG5cdCAqIEBwYXJhbSAge051bWJlcn0gaGVpZ2h0ICAgICAgICAgdGhlIG5ldyBoZWlnaHQgb2YgdGhpcyB0ZXh0dXJlXG5cdCAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVmYXVsdHMgdG8gdGhlIGxhc3QgdXNlZCBoZWlnaHQgKG9yIHplcm8pXG5cdCAqIEBwYXJhbSAge0dMZW51bX0gZm9ybWF0ICAgICAgICAgdGhlIGRhdGEgZm9ybWF0LCBkZWZhdWx0IFJHQkFcblx0ICogQHBhcmFtICB7R0xlbnVtfSB0eXBlICAgICAgICAgICB0aGUgZGF0YSB0eXBlLCBkZWZhdWx0IFVOU0lHTkVEX0JZVEUgKFVpbnQ4QXJyYXkpXG5cdCAqIEBwYXJhbSAge0FycmF5QnVmZmVyVmlld30gZGF0YSAgdGhlIHJhdyBkYXRhIGZvciB0aGlzIHRleHR1cmUsIG9yIG51bGwgZm9yIGFuIGVtcHR5IGltYWdlXG5cdCAqIEBwYXJhbSAge0Jvb2xlYW59IGdlbk1pcG1hcHNcdCAgIHdoZXRoZXIgdG8gZ2VuZXJhdGUgbWlwbWFwcyBhZnRlciB1cGxvYWRpbmcgdGhlIGRhdGEsIGRlZmF1bHQgZmFsc2Vcblx0ICovXG5cdHVwbG9hZERhdGE6IGZ1bmN0aW9uKHdpZHRoLCBoZWlnaHQsIGZvcm1hdCwgdHlwZSwgZGF0YSwgZ2VuTWlwbWFwcykge1xuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cblx0XHR0aGlzLmZvcm1hdCA9IGZvcm1hdCB8fCBnbC5SR0JBO1xuXHRcdHR5cGUgPSB0eXBlIHx8IGdsLlVOU0lHTkVEX0JZVEU7XG5cdFx0ZGF0YSA9IGRhdGEgfHwgbnVsbDsgLy9tYWtlIHN1cmUgZmFsc2V5IHZhbHVlIGlzIG51bGwgZm9yIHRleEltYWdlMkRcblxuXHRcdHRoaXMud2lkdGggPSAod2lkdGggfHwgd2lkdGg9PTApID8gd2lkdGggOiB0aGlzLndpZHRoO1xuXHRcdHRoaXMuaGVpZ2h0ID0gKGhlaWdodCB8fCBoZWlnaHQ9PTApID8gaGVpZ2h0IDogdGhpcy5oZWlnaHQ7XG5cblx0XHR0aGlzLl9jaGVja1BPVCgpO1xuXG5cdFx0dGhpcy5iaW5kKCk7XG5cblx0XHRnbC50ZXhJbWFnZTJEKHRoaXMudGFyZ2V0LCAwLCB0aGlzLmZvcm1hdCwgXG5cdFx0XHRcdFx0ICB0aGlzLndpZHRoLCB0aGlzLmhlaWdodCwgMCwgdGhpcy5mb3JtYXQsXG5cdFx0XHRcdFx0ICB0eXBlLCBkYXRhKTtcblxuXHRcdGlmIChnZW5NaXBtYXBzKVxuXHRcdFx0Z2wuZ2VuZXJhdGVNaXBtYXAodGhpcy50YXJnZXQpO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBVcGxvYWRzIEltYWdlRGF0YSwgSFRNTEltYWdlRWxlbWVudCwgSFRNTENhbnZhc0VsZW1lbnQgb3IgXG5cdCAqIEhUTUxWaWRlb0VsZW1lbnQuXG5cdCAqXG5cdCAqIEBtZXRob2QgIHVwbG9hZEltYWdlXG5cdCAqIEBwYXJhbSAge09iamVjdH0gZG9tT2JqZWN0IHRoZSBET00gaW1hZ2UgY29udGFpbmVyXG5cdCAqIEBwYXJhbSAge0dMZW51bX0gZm9ybWF0IHRoZSBmb3JtYXQsIGRlZmF1bHQgZ2wuUkdCQVxuXHQgKiBAcGFyYW0gIHtHTGVudW19IHR5cGUgdGhlIGRhdGEgdHlwZSwgZGVmYXVsdCBnbC5VTlNJR05FRF9CWVRFXG5cdCAqIEBwYXJhbSAge0Jvb2xlYW59IGdlbk1pcG1hcHMgd2hldGhlciB0byBnZW5lcmF0ZSBtaXBtYXBzIGFmdGVyIHVwbG9hZGluZyB0aGUgZGF0YSwgZGVmYXVsdCBmYWxzZVxuXHQgKi9cblx0dXBsb2FkSW1hZ2U6IGZ1bmN0aW9uKGRvbU9iamVjdCwgZm9ybWF0LCB0eXBlLCBnZW5NaXBtYXBzKSB7XG5cdFx0dmFyIGdsID0gdGhpcy5nbDtcblxuXHRcdHRoaXMuZm9ybWF0ID0gZm9ybWF0IHx8IGdsLlJHQkE7XG5cdFx0dHlwZSA9IHR5cGUgfHwgZ2wuVU5TSUdORURfQllURTtcblx0XHRcblx0XHR0aGlzLndpZHRoID0gZG9tT2JqZWN0LndpZHRoO1xuXHRcdHRoaXMuaGVpZ2h0ID0gZG9tT2JqZWN0LmhlaWdodDtcblxuXHRcdHRoaXMuX2NoZWNrUE9UKCk7XG5cblx0XHR0aGlzLmJpbmQoKTtcblxuXHRcdGdsLnRleEltYWdlMkQodGhpcy50YXJnZXQsIDAsIHRoaXMuZm9ybWF0LCB0aGlzLmZvcm1hdCxcblx0XHRcdFx0XHQgIHR5cGUsIGRvbU9iamVjdCk7XG5cblx0XHRpZiAoZ2VuTWlwbWFwcylcblx0XHRcdGdsLmdlbmVyYXRlTWlwbWFwKHRoaXMudGFyZ2V0KTtcblx0fSxcblxuXHQvKipcblx0ICogSWYgRk9SQ0VfUE9UIGlzIGZhbHNlLCB3ZSB2ZXJpZnkgdGhpcyB0ZXh0dXJlIHRvIHNlZSBpZiBpdCBpcyB2YWxpZCwgXG5cdCAqIGFzIHBlciBub24tcG93ZXItb2YtdHdvIHJ1bGVzLiBJZiBpdCBpcyBub24tcG93ZXItb2YtdHdvLCBpdCBtdXN0IGhhdmUgXG5cdCAqIGEgd3JhcCBtb2RlIG9mIENMQU1QX1RPX0VER0UsIGFuZCB0aGUgbWluaWZpY2F0aW9uIGZpbHRlciBtdXN0IGJlIExJTkVBUlxuXHQgKiBvciBORUFSRVNULiBJZiB3ZSBkb24ndCBzYXRpc2Z5IHRoZXNlIG5lZWRzLCBhbiBlcnJvciBpcyB0aHJvd24uXG5cdCAqIFxuXHQgKiBAbWV0aG9kICBfY2hlY2tQT1Rcblx0ICogQHByaXZhdGVcblx0ICogQHJldHVybiB7W3R5cGVdfSBbZGVzY3JpcHRpb25dXG5cdCAqL1xuXHRfY2hlY2tQT1Q6IGZ1bmN0aW9uKCkge1xuXHRcdGlmICghVGV4dHVyZS5GT1JDRV9QT1QpIHtcblx0XHRcdC8vSWYgbWluRmlsdGVyIGlzIGFueXRoaW5nIGJ1dCBMSU5FQVIgb3IgTkVBUkVTVFxuXHRcdFx0Ly9vciBpZiB3cmFwUyBvciB3cmFwVCBhcmUgbm90IENMQU1QX1RPX0VER0UuLi5cblx0XHRcdHZhciB3cm9uZ0ZpbHRlciA9ICh0aGlzLm1pbkZpbHRlciAhPT0gVGV4dHVyZS5GaWx0ZXIuTElORUFSICYmIHRoaXMubWluRmlsdGVyICE9PSBUZXh0dXJlLkZpbHRlci5ORUFSRVNUKTtcblx0XHRcdHZhciB3cm9uZ1dyYXAgPSAodGhpcy53cmFwUyAhPT0gVGV4dHVyZS5XcmFwLkNMQU1QX1RPX0VER0UgfHwgdGhpcy53cmFwVCAhPT0gVGV4dHVyZS5XcmFwLkNMQU1QX1RPX0VER0UpO1xuXG5cdFx0XHRpZiAoIHdyb25nRmlsdGVyIHx8IHdyb25nV3JhcCApIHtcblx0XHRcdFx0aWYgKCFpc1Bvd2VyT2ZUd28odGhpcy53aWR0aCkgfHwgIWlzUG93ZXJPZlR3byh0aGlzLmhlaWdodCkpXG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKHdyb25nRmlsdGVyIFxuXHRcdFx0XHRcdFx0XHQ/IFwiTm9uLXBvd2VyLW9mLXR3byB0ZXh0dXJlcyBjYW5ub3QgdXNlIG1pcG1hcHBpbmcgYXMgZmlsdGVyXCJcblx0XHRcdFx0XHRcdFx0OiBcIk5vbi1wb3dlci1vZi10d28gdGV4dHVyZXMgbXVzdCB1c2UgQ0xBTVBfVE9fRURHRSBhcyB3cmFwXCIpO1xuXHRcdFx0fVxuXHRcdH1cblx0fSxcblxuXHQvKipcblx0ICogQmluZHMgdGhlIHRleHR1cmUuIElmIHVuaXQgaXMgc3BlY2lmaWVkLFxuXHQgKiBpdCB3aWxsIGJpbmQgdGhlIHRleHR1cmUgYXQgdGhlIGdpdmVuIHNsb3Rcblx0ICogKFRFWFRVUkUwLCBURVhUVVJFMSwgZXRjKS4gSWYgdW5pdCBpcyBub3Qgc3BlY2lmaWVkLFxuXHQgKiBpdCB3aWxsIHNpbXBseSBiaW5kIHRoZSB0ZXh0dXJlIGF0IHdoaWNoZXZlciBzbG90XG5cdCAqIGlzIGN1cnJlbnRseSBhY3RpdmUuXG5cdCAqXG5cdCAqIEBtZXRob2QgIGJpbmRcblx0ICogQHBhcmFtICB7TnVtYmVyfSB1bml0IHRoZSB0ZXh0dXJlIHVuaXQgaW5kZXgsIHN0YXJ0aW5nIGF0IDBcblx0ICovXG5cdGJpbmQ6IGZ1bmN0aW9uKHVuaXQpIHtcblx0XHR2YXIgZ2wgPSB0aGlzLmdsO1xuXHRcdGlmICh1bml0IHx8IHVuaXQgPT09IDApXG5cdFx0XHRnbC5hY3RpdmVUZXh0dXJlKGdsLlRFWFRVUkUwICsgdW5pdCk7XG5cdFx0Z2wuYmluZFRleHR1cmUodGhpcy50YXJnZXQsIHRoaXMuaWQpO1xuXHR9LFxuXG5cdHRvU3RyaW5nOiBmdW5jdGlvbigpIHtcblx0XHRyZXR1cm4gdGhpcy5pZCArIFwiOlwiICsgdGhpcy53aWR0aCArIFwieFwiICsgdGhpcy5oZWlnaHQgKyBcIlwiO1xuXHR9XG59KTtcblxuLyoqIFxuICogQSBzZXQgb2YgRmlsdGVyIGNvbnN0YW50cyB0aGF0IG1hdGNoIHRoZWlyIEdMIGNvdW50ZXJwYXJ0cy5cbiAqIFRoaXMgaXMgZm9yIGNvbnZlbmllbmNlLCB0byBhdm9pZCB0aGUgbmVlZCBmb3IgYSBHTCByZW5kZXJpbmcgY29udGV4dC5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgXG4gKiAgICAgVGV4dHVyZS5GaWx0ZXIuTkVBUkVTVFxuICogICAgIFRleHR1cmUuRmlsdGVyLk5FQVJFU1RfTUlQTUFQX0xJTkVBUlxuICogICAgIFRleHR1cmUuRmlsdGVyLk5FQVJFU1RfTUlQTUFQX05FQVJFU1RcbiAqICAgICBUZXh0dXJlLkZpbHRlci5MSU5FQVJcbiAqICAgICBUZXh0dXJlLkZpbHRlci5MSU5FQVJfTUlQTUFQX0xJTkVBUlxuICogICAgIFRleHR1cmUuRmlsdGVyLkxJTkVBUl9NSVBNQVBfTkVBUkVTVFxuICogYGBgXG4gKiBAYXR0cmlidXRlIEZpbHRlclxuICogQHN0YXRpY1xuICogQHR5cGUge09iamVjdH1cbiAqL1xuVGV4dHVyZS5GaWx0ZXIgPSB7XG5cdE5FQVJFU1Q6IDk3MjgsXG5cdE5FQVJFU1RfTUlQTUFQX0xJTkVBUjogOTk4Nixcblx0TkVBUkVTVF9NSVBNQVBfTkVBUkVTVDogOTk4NCxcblx0TElORUFSOiA5NzI5LFxuXHRMSU5FQVJfTUlQTUFQX0xJTkVBUjogOTk4Nyxcblx0TElORUFSX01JUE1BUF9ORUFSRVNUOiA5OTg1XG59O1xuXG4vKiogXG4gKiBBIHNldCBvZiBXcmFwIGNvbnN0YW50cyB0aGF0IG1hdGNoIHRoZWlyIEdMIGNvdW50ZXJwYXJ0cy5cbiAqIFRoaXMgaXMgZm9yIGNvbnZlbmllbmNlLCB0byBhdm9pZCB0aGUgbmVlZCBmb3IgYSBHTCByZW5kZXJpbmcgY29udGV4dC5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgXG4gKiAgICAgVGV4dHVyZS5XcmFwLkNMQU1QX1RPX0VER0VcbiAqICAgICBUZXh0dXJlLldyYXAuTUlSUk9SRURfUkVQRUFUXG4gKiAgICAgVGV4dHVyZS5XcmFwLlJFUEVBVFxuICogYGBgXG4gKiBAYXR0cmlidXRlIFdyYXBcbiAqIEBzdGF0aWNcbiAqIEB0eXBlIHtPYmplY3R9XG4gKi9cblRleHR1cmUuV3JhcCA9IHtcblx0Q0xBTVBfVE9fRURHRTogMzMwNzEsXG5cdE1JUlJPUkVEX1JFUEVBVDogMzM2NDgsXG5cdFJFUEVBVDogMTA0OTdcbn07XG5cbi8qKiBcbiAqIEEgc2V0IG9mIEZvcm1hdCBjb25zdGFudHMgdGhhdCBtYXRjaCB0aGVpciBHTCBjb3VudGVycGFydHMuXG4gKiBUaGlzIGlzIGZvciBjb252ZW5pZW5jZSwgdG8gYXZvaWQgdGhlIG5lZWQgZm9yIGEgR0wgcmVuZGVyaW5nIGNvbnRleHQuXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYFxuICogICAgIFRleHR1cmUuRm9ybWF0LlJHQlxuICogICAgIFRleHR1cmUuRm9ybWF0LlJHQkFcbiAqICAgICBUZXh0dXJlLkZvcm1hdC5MVU1JTkFOQ0VfQUxQSEFcbiAqIGBgYFxuICogQGF0dHJpYnV0ZSBGb3JtYXRcbiAqIEBzdGF0aWNcbiAqIEB0eXBlIHtPYmplY3R9XG4gKi9cblRleHR1cmUuRm9ybWF0ID0ge1xuXHRERVBUSF9DT01QT05FTlQ6IDY0MDIsXG5cdEFMUEhBOiA2NDA2LFxuXHRSR0JBOiA2NDA4LFxuXHRSR0I6IDY0MDcsXG5cdExVTUlOQU5DRTogNjQwOSxcblx0TFVNSU5BTkNFX0FMUEhBOiA2NDEwXG59O1xuXG4vKiogXG4gKiBBIHNldCBvZiBEYXRhVHlwZSBjb25zdGFudHMgdGhhdCBtYXRjaCB0aGVpciBHTCBjb3VudGVycGFydHMuXG4gKiBUaGlzIGlzIGZvciBjb252ZW5pZW5jZSwgdG8gYXZvaWQgdGhlIG5lZWQgZm9yIGEgR0wgcmVuZGVyaW5nIGNvbnRleHQuXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYFxuICogICAgIFRleHR1cmUuRGF0YVR5cGUuVU5TSUdORURfQllURSBcbiAqICAgICBUZXh0dXJlLkRhdGFUeXBlLkZMT0FUIFxuICogYGBgXG4gKiBAYXR0cmlidXRlIERhdGFUeXBlXG4gKiBAc3RhdGljXG4gKiBAdHlwZSB7T2JqZWN0fVxuICovXG5UZXh0dXJlLkRhdGFUeXBlID0ge1xuXHRCWVRFOiA1MTIwLFxuXHRTSE9SVDogNTEyMixcblx0SU5UOiA1MTI0LFxuXHRGTE9BVDogNTEyNixcblx0VU5TSUdORURfQllURTogNTEyMSxcblx0VU5TSUdORURfSU5UOiA1MTI1LFxuXHRVTlNJR05FRF9TSE9SVDogNTEyMyxcblx0VU5TSUdORURfU0hPUlRfNF80XzRfNDogMzI4MTksXG5cdFVOU0lHTkVEX1NIT1JUXzVfNV81XzE6IDMyODIwLFxuXHRVTlNJR05FRF9TSE9SVF81XzZfNTogMzM2MzVcbn1cblxuLyoqXG4gKiBUaGUgZGVmYXVsdCB3cmFwIG1vZGUgd2hlbiBjcmVhdGluZyBuZXcgdGV4dHVyZXMuIElmIGEgY3VzdG9tIFxuICogcHJvdmlkZXIgd2FzIHNwZWNpZmllZCwgaXQgbWF5IGNob29zZSB0byBvdmVycmlkZSB0aGlzIGRlZmF1bHQgbW9kZS5cbiAqIFxuICogQGF0dHJpYnV0ZSB7R0xlbnVtfSBERUZBVUxUX1dSQVBcbiAqIEBzdGF0aWMgXG4gKiBAZGVmYXVsdCAgVGV4dHVyZS5XcmFwLkNMQU1QX1RPX0VER0VcbiAqL1xuVGV4dHVyZS5ERUZBVUxUX1dSQVAgPSBUZXh0dXJlLldyYXAuQ0xBTVBfVE9fRURHRTtcblxuXG4vKipcbiAqIFRoZSBkZWZhdWx0IGZpbHRlciBtb2RlIHdoZW4gY3JlYXRpbmcgbmV3IHRleHR1cmVzLiBJZiBhIGN1c3RvbVxuICogcHJvdmlkZXIgd2FzIHNwZWNpZmllZCwgaXQgbWF5IGNob29zZSB0byBvdmVycmlkZSB0aGlzIGRlZmF1bHQgbW9kZS5cbiAqXG4gKiBAYXR0cmlidXRlIHtHTGVudW19IERFRkFVTFRfRklMVEVSXG4gKiBAc3RhdGljXG4gKiBAZGVmYXVsdCAgVGV4dHVyZS5GaWx0ZXIuTElORUFSXG4gKi9cblRleHR1cmUuREVGQVVMVF9GSUxURVIgPSBUZXh0dXJlLkZpbHRlci5ORUFSRVNUO1xuXG4vKipcbiAqIEJ5IGRlZmF1bHQsIHdlIGRvIHNvbWUgZXJyb3IgY2hlY2tpbmcgd2hlbiBjcmVhdGluZyB0ZXh0dXJlc1xuICogdG8gZW5zdXJlIHRoYXQgdGhleSB3aWxsIGJlIFwicmVuZGVyYWJsZVwiIGJ5IFdlYkdMLiBOb24tcG93ZXItb2YtdHdvXG4gKiB0ZXh0dXJlcyBtdXN0IHVzZSBDTEFNUF9UT19FREdFIGFzIHRoZWlyIHdyYXAgbW9kZSwgYW5kIE5FQVJFU1Qgb3IgTElORUFSXG4gKiBhcyB0aGVpciB3cmFwIG1vZGUuIEZ1cnRoZXIsIHRyeWluZyB0byBnZW5lcmF0ZSBtaXBtYXBzIGZvciBhIE5QT1QgaW1hZ2VcbiAqIHdpbGwgbGVhZCB0byBlcnJvcnMuIFxuICpcbiAqIEhvd2V2ZXIsIHlvdSBjYW4gZGlzYWJsZSB0aGlzIGVycm9yIGNoZWNraW5nIGJ5IHNldHRpbmcgYEZPUkNFX1BPVGAgdG8gdHJ1ZS5cbiAqIFRoaXMgbWF5IGJlIHVzZWZ1bCBpZiB5b3UgYXJlIHJ1bm5pbmcgb24gc3BlY2lmaWMgaGFyZHdhcmUgdGhhdCBzdXBwb3J0cyBQT1QgXG4gKiB0ZXh0dXJlcywgb3IgaW4gc29tZSBmdXR1cmUgY2FzZSB3aGVyZSBOUE9UIHRleHR1cmVzIGlzIGFkZGVkIGFzIGEgV2ViR0wgZXh0ZW5zaW9uLlxuICogXG4gKiBAYXR0cmlidXRlIHtCb29sZWFufSBGT1JDRV9QT1RcbiAqIEBzdGF0aWNcbiAqIEBkZWZhdWx0ICBmYWxzZVxuICovXG5UZXh0dXJlLkZPUkNFX1BPVCA9IGZhbHNlO1xuXG4vL2RlZmF1bHQgcGl4ZWwgc3RvcmUgb3BlcmF0aW9ucy4gVXNlZCBpbiBjcmVhdGUoKVxuVGV4dHVyZS5VTlBBQ0tfRkxJUF9ZID0gZmFsc2U7XG5UZXh0dXJlLlVOUEFDS19BTElHTk1FTlQgPSAxO1xuVGV4dHVyZS5VTlBBQ0tfUFJFTVVMVElQTFlfQUxQSEEgPSB0cnVlOyBcblRleHR1cmUuVU5QQUNLX0NPTE9SU1BBQ0VfQ09OVkVSU0lPTiA9IHVuZGVmaW5lZDtcblxuLyoqXG4gKiBVdGlsaXR5IHRvIGdldCB0aGUgbnVtYmVyIG9mIGNvbXBvbmVudHMgZm9yIHRoZSBnaXZlbiBHTGVudW0sIGUuZy4gZ2wuUkdCQSByZXR1cm5zIDQuXG4gKiBSZXR1cm5zIG51bGwgaWYgdGhlIHNwZWNpZmllZCBmb3JtYXQgaXMgbm90IG9mIHR5cGUgREVQVEhfQ09NUE9ORU5ULCBBTFBIQSwgTFVNSU5BTkNFLFxuICogTFVNSU5BTkNFX0FMUEhBLCBSR0IsIG9yIFJHQkEuXG4gKiBcbiAqIEBtZXRob2QgZ2V0TnVtQ29tcG9uZW50c1xuICogQHN0YXRpY1xuICogQHBhcmFtICB7R0xlbnVtfSBmb3JtYXQgYSB0ZXh0dXJlIGZvcm1hdCwgaS5lLiBUZXh0dXJlLkZvcm1hdC5SR0JBXG4gKiBAcmV0dXJuIHtOdW1iZXJ9IHRoZSBudW1iZXIgb2YgY29tcG9uZW50cyBmb3IgdGhpcyBmb3JtYXRcbiAqL1xuVGV4dHVyZS5nZXROdW1Db21wb25lbnRzID0gZnVuY3Rpb24oZm9ybWF0KSB7XG5cdHN3aXRjaCAoZm9ybWF0KSB7XG5cdFx0Y2FzZSBUZXh0dXJlLkZvcm1hdC5ERVBUSF9DT01QT05FTlQ6XG5cdFx0Y2FzZSBUZXh0dXJlLkZvcm1hdC5BTFBIQTpcblx0XHRjYXNlIFRleHR1cmUuRm9ybWF0LkxVTUlOQU5DRTpcblx0XHRcdHJldHVybiAxO1xuXHRcdGNhc2UgVGV4dHVyZS5Gb3JtYXQuTFVNSU5BTkNFX0FMUEhBOlxuXHRcdFx0cmV0dXJuIDI7XG5cdFx0Y2FzZSBUZXh0dXJlLkZvcm1hdC5SR0I6XG5cdFx0XHRyZXR1cm4gMztcblx0XHRjYXNlIFRleHR1cmUuRm9ybWF0LlJHQkE6XG5cdFx0XHRyZXR1cm4gNDtcblx0fVxuXHRyZXR1cm4gbnVsbDtcbn07XG5cbi8vVW5tYW5hZ2VkIHRleHR1cmVzOlxuLy9cdEhUTUwgZWxlbWVudHMgbGlrZSBJbWFnZSwgVmlkZW8sIENhbnZhc1xuLy9cdHBpeGVscyBidWZmZXIgZnJvbSBDYW52YXNcbi8vXHRwaXhlbHMgYXJyYXlcblxuLy9OZWVkIHNwZWNpYWwgaGFuZGxpbmc6XG4vLyAgY29udGV4dC5vbkNvbnRleHRMb3N0LmFkZChmdW5jdGlvbigpIHtcbi8vICBcdGNyZWF0ZUR5bmFtaWNUZXh0dXJlKCk7XG4vLyAgfS5iaW5kKHRoaXMpKTtcblxuLy9NYW5hZ2VkIHRleHR1cmVzOlxuLy9cdGltYWdlcyBzcGVjaWZpZWQgd2l0aCBhIHBhdGhcbi8vXHR0aGlzIHdpbGwgdXNlIEltYWdlIHVuZGVyIHRoZSBob29kXG5cblxubW9kdWxlLmV4cG9ydHMgPSBUZXh0dXJlOyIsInZhciBDbGFzcyA9IHJlcXVpcmUoJ2tsYXNzZScpO1xudmFyIFRleHR1cmUgPSByZXF1aXJlKCcuL1RleHR1cmUnKTtcblxuLy9UaGlzIGlzIGEgR0wtc3BlY2lmaWMgdGV4dHVyZSByZWdpb24sIGVtcGxveWluZyB0YW5nZW50IHNwYWNlIG5vcm1hbGl6ZWQgY29vcmRpbmF0ZXMgVSBhbmQgVi5cbi8vQSBjYW52YXMtc3BlY2lmaWMgcmVnaW9uIHdvdWxkIHJlYWxseSBqdXN0IGJlIGEgbGlnaHR3ZWlnaHQgb2JqZWN0IHdpdGggeyB4LCB5LCB3aWR0aCwgaGVpZ2h0IH1cbi8vaW4gcGl4ZWxzLlxudmFyIFRleHR1cmVSZWdpb24gPSBuZXcgQ2xhc3Moe1xuXG5cdGluaXRpYWxpemU6IGZ1bmN0aW9uIFRleHR1cmVSZWdpb24odGV4dHVyZSwgeCwgeSwgd2lkdGgsIGhlaWdodCkge1xuXHRcdHRoaXMudGV4dHVyZSA9IHRleHR1cmU7XG5cdFx0dGhpcy5zZXRSZWdpb24oeCwgeSwgd2lkdGgsIGhlaWdodCk7XG5cdH0sXG5cblx0c2V0VVZzOiBmdW5jdGlvbih1LCB2LCB1MiwgdjIpIHtcblx0XHR0aGlzLnJlZ2lvbldpZHRoID0gTWF0aC5yb3VuZChNYXRoLmFicyh1MiAtIHUpICogdGhpcy50ZXh0dXJlLndpZHRoKTtcbiAgICAgICAgdGhpcy5yZWdpb25IZWlnaHQgPSBNYXRoLnJvdW5kKE1hdGguYWJzKHYyIC0gdikgKiB0aGlzLnRleHR1cmUuaGVpZ2h0KTtcblxuICAgICAgICAvLyBGcm9tIExpYkdEWCBUZXh0dXJlUmVnaW9uLmphdmEgLS0gXG5cdFx0Ly8gRm9yIGEgMXgxIHJlZ2lvbiwgYWRqdXN0IFVWcyB0b3dhcmQgcGl4ZWwgY2VudGVyIHRvIGF2b2lkIGZpbHRlcmluZyBhcnRpZmFjdHMgb24gQU1EIEdQVXMgd2hlbiBkcmF3aW5nIHZlcnkgc3RyZXRjaGVkLlxuXHRcdGlmICh0aGlzLnJlZ2lvbldpZHRoID09IDEgJiYgdGhpcy5yZWdpb25IZWlnaHQgPT0gMSkge1xuXHRcdFx0dmFyIGFkanVzdFggPSAwLjI1IC8gdGhpcy50ZXh0dXJlLndpZHRoO1xuXHRcdFx0dSArPSBhZGp1c3RYO1xuXHRcdFx0dTIgLT0gYWRqdXN0WDtcblx0XHRcdHZhciBhZGp1c3RZID0gMC4yNSAvIHRoaXMudGV4dHVyZS5oZWlnaHQ7XG5cdFx0XHR2ICs9IGFkanVzdFk7XG5cdFx0XHR2MiAtPSBhZGp1c3RZO1xuXHRcdH1cblxuXHRcdHRoaXMudSA9IHU7XG5cdFx0dGhpcy52ID0gdjtcblx0XHR0aGlzLnUyID0gdTI7XG5cdFx0dGhpcy52MiA9IHYyO1xuXHR9LFxuXG5cdHNldFJlZ2lvbjogZnVuY3Rpb24oeCwgeSwgd2lkdGgsIGhlaWdodCkge1xuXHRcdHggPSB4IHx8IDA7XG5cdFx0eSA9IHkgfHwgMDtcblx0XHR3aWR0aCA9ICh3aWR0aD09PTAgfHwgd2lkdGgpID8gd2lkdGggOiB0aGlzLnRleHR1cmUud2lkdGg7XG5cdFx0aGVpZ2h0ID0gKGhlaWdodD09PTAgfHwgaGVpZ2h0KSA/IGhlaWdodCA6IHRoaXMudGV4dHVyZS5oZWlnaHQ7XG5cblx0XHR2YXIgaW52VGV4V2lkdGggPSAxIC8gdGhpcy50ZXh0dXJlLndpZHRoO1xuXHRcdHZhciBpbnZUZXhIZWlnaHQgPSAxIC8gdGhpcy50ZXh0dXJlLmhlaWdodDtcblx0XHR0aGlzLnNldFVWcyh4ICogaW52VGV4V2lkdGgsIHkgKiBpbnZUZXhIZWlnaHQsICh4ICsgd2lkdGgpICogaW52VGV4V2lkdGgsICh5ICsgaGVpZ2h0KSAqIGludlRleEhlaWdodCk7XG5cdFx0dGhpcy5yZWdpb25XaWR0aCA9IE1hdGguYWJzKHdpZHRoKTtcblx0XHR0aGlzLnJlZ2lvbkhlaWdodCA9IE1hdGguYWJzKGhlaWdodCk7XG5cdH0sXG5cblx0LyoqIFNldHMgdGhlIHRleHR1cmUgdG8gdGhhdCBvZiB0aGUgc3BlY2lmaWVkIHJlZ2lvbiBhbmQgc2V0cyB0aGUgY29vcmRpbmF0ZXMgcmVsYXRpdmUgdG8gdGhlIHNwZWNpZmllZCByZWdpb24uICovXG5cdHNldEZyb21SZWdpb246IGZ1bmN0aW9uKHJlZ2lvbiwgeCwgeSwgd2lkdGgsIGhlaWdodCkge1xuXHRcdHRoaXMudGV4dHVyZSA9IHJlZ2lvbi50ZXh0dXJlO1xuXHRcdHRoaXMuc2V0KHJlZ2lvbi5nZXRSZWdpb25YKCkgKyB4LCByZWdpb24uZ2V0UmVnaW9uWSgpICsgeSwgd2lkdGgsIGhlaWdodCk7XG5cdH0sXG5cblxuXHQvL1RPRE86IGFkZCBzZXR0ZXJzIGZvciByZWdpb25YL1kgYW5kIHJlZ2lvbldpZHRoL0hlaWdodFxuXG5cdHJlZ2lvblg6IHtcblx0XHRnZXQ6IGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIE1hdGgucm91bmQodGhpcy51ICogdGhpcy50ZXh0dXJlLndpZHRoKTtcblx0XHR9IFxuXHR9LFxuXG5cdHJlZ2lvblk6IHtcblx0XHRnZXQ6IGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIE1hdGgucm91bmQodGhpcy52ICogdGhpcy50ZXh0dXJlLmhlaWdodCk7XG5cdFx0fVxuXHR9LFxuXG5cdGZsaXA6IGZ1bmN0aW9uKHgsIHkpIHtcblx0XHR2YXIgdGVtcDtcblx0XHRpZiAoeCkge1xuXHRcdFx0dGVtcCA9IHRoaXMudTtcblx0XHRcdHRoaXMudSA9IHRoaXMudTI7XG5cdFx0XHR0aGlzLnUyID0gdGVtcDtcblx0XHR9XG5cdFx0aWYgKHkpIHtcblx0XHRcdHRlbXAgPSB0aGlzLnY7XG5cdFx0XHR0aGlzLnYgPSB0aGlzLnYyO1xuXHRcdFx0dGhpcy52MiA9IHRlbXA7XG5cdFx0fVxuXHR9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBUZXh0dXJlUmVnaW9uOyIsIi8qKlxuICogQG1vZHVsZSBrYW1pXG4gKi9cblxudmFyIENsYXNzID0gcmVxdWlyZSgna2xhc3NlJyk7XG52YXIgU2lnbmFsID0gcmVxdWlyZSgnc2lnbmFscycpO1xuXG4vKipcbiAqIEEgdGhpbiB3cmFwcGVyIGFyb3VuZCBXZWJHTFJlbmRlcmluZ0NvbnRleHQgd2hpY2ggaGFuZGxlc1xuICogY29udGV4dCBsb3NzIGFuZCByZXN0b3JlIHdpdGggdmFyaW91cyByZW5kZXJpbmcgb2JqZWN0cyAodGV4dHVyZXMsXG4gKiBzaGFkZXJzIGFuZCBidWZmZXJzKS4gVGhpcyBhbHNvIGhhbmRsZXMgZ2VuZXJhbCB2aWV3cG9ydCBtYW5hZ2VtZW50LlxuICpcbiAqIElmIHRoZSB2aWV3IGlzIG5vdCBzcGVjaWZpZWQsIGEgY2FudmFzIHdpbGwgYmUgY3JlYXRlZC5cbiAqIFxuICogQGNsYXNzICBXZWJHTENvbnRleHRcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHtOdW1iZXJ9IHdpZHRoIHRoZSB3aWR0aCBvZiB0aGUgR0wgY2FudmFzXG4gKiBAcGFyYW0ge051bWJlcn0gaGVpZ2h0IHRoZSBoZWlnaHQgb2YgdGhlIEdMIGNhbnZhc1xuICogQHBhcmFtIHtIVE1MQ2FudmFzRWxlbWVudH0gdmlldyB0aGUgb3B0aW9uYWwgRE9NIGNhbnZhcyBlbGVtZW50XG4gKiBAcGFyYW0ge09iamVjdH0gY29udGV4dEF0dHJpYnVldHMgYW4gb2JqZWN0IGNvbnRhaW5pbmcgY29udGV4dCBhdHRyaWJzIHdoaWNoXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgd2lsbCBiZSB1c2VkIGR1cmluZyBHTCBpbml0aWFsaXphdGlvblxuICovXG52YXIgV2ViR0xDb250ZXh0ID0gbmV3IENsYXNzKHtcblx0XG5cdGluaXRpYWxpemU6IGZ1bmN0aW9uIFdlYkdMQ29udGV4dCh3aWR0aCwgaGVpZ2h0LCB2aWV3LCBjb250ZXh0QXR0cmlidXRlcykge1xuXHRcdC8qKlxuXHRcdCAqIFRoZSBsaXN0IG9mIHJlbmRlcmluZyBvYmplY3RzIChzaGFkZXJzLCBWQk9zLCB0ZXh0dXJlcywgZXRjKSB3aGljaCBhcmUgXG5cdFx0ICogY3VycmVudGx5IGJlaW5nIG1hbmFnZWQuIEFueSBvYmplY3Qgd2l0aCBhIFwiY3JlYXRlXCIgbWV0aG9kIGNhbiBiZSBhZGRlZFxuXHRcdCAqIHRvIHRoaXMgbGlzdC4gVXBvbiBkZXN0cm95aW5nIHRoZSByZW5kZXJpbmcgb2JqZWN0LCBpdCBzaG91bGQgYmUgcmVtb3ZlZC5cblx0XHQgKiBTZWUgYWRkTWFuYWdlZE9iamVjdCBhbmQgcmVtb3ZlTWFuYWdlZE9iamVjdC5cblx0XHQgKiBcblx0XHQgKiBAcHJvcGVydHkge0FycmF5fSBtYW5hZ2VkT2JqZWN0c1xuXHRcdCAqL1xuXHRcdHRoaXMubWFuYWdlZE9iamVjdHMgPSBbXTtcblxuXHRcdC8qKlxuXHRcdCAqIFRoZSBhY3R1YWwgR0wgY29udGV4dC4gWW91IGNhbiB1c2UgdGhpcyBmb3Jcblx0XHQgKiByYXcgR0wgY2FsbHMgb3IgdG8gYWNjZXNzIEdMZW51bSBjb25zdGFudHMuIFRoaXNcblx0XHQgKiB3aWxsIGJlIHVwZGF0ZWQgb24gY29udGV4dCByZXN0b3JlLiBXaGlsZSB0aGUgV2ViR0xDb250ZXh0XG5cdFx0ICogaXMgbm90IGB2YWxpZGAsIHlvdSBzaG91bGQgbm90IHRyeSB0byBhY2Nlc3MgR0wgc3RhdGUuXG5cdFx0ICogXG5cdFx0ICogQHByb3BlcnR5IGdsXG5cdFx0ICogQHR5cGUge1dlYkdMUmVuZGVyaW5nQ29udGV4dH1cblx0XHQgKi9cblx0XHR0aGlzLmdsID0gbnVsbDtcblxuXHRcdC8qKlxuXHRcdCAqIFRoZSBjYW52YXMgRE9NIGVsZW1lbnQgZm9yIHRoaXMgY29udGV4dC5cblx0XHQgKiBAcHJvcGVydHkge051bWJlcn0gdmlld1xuXHRcdCAqL1xuXHRcdHRoaXMudmlldyA9IHZpZXcgfHwgZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImNhbnZhc1wiKTtcblxuXHRcdC8vZGVmYXVsdCBzaXplIGFzIHBlciBzcGVjOlxuXHRcdC8vaHR0cDovL3d3dy53My5vcmcvVFIvMjAxMi9XRC1odG1sNS1hdXRob3ItMjAxMjAzMjkvdGhlLWNhbnZhcy1lbGVtZW50Lmh0bWwjdGhlLWNhbnZhcy1lbGVtZW50XG5cdFx0XG5cdFx0LyoqXG5cdFx0ICogVGhlIHdpZHRoIG9mIHRoaXMgY2FudmFzLlxuXHRcdCAqXG5cdFx0ICogQHByb3BlcnR5IHdpZHRoXG5cdFx0ICogQHR5cGUge051bWJlcn1cblx0XHQgKi9cblx0XHR0aGlzLndpZHRoID0gdGhpcy52aWV3LndpZHRoID0gd2lkdGggfHwgMzAwO1xuXG5cdFx0LyoqXG5cdFx0ICogVGhlIGhlaWdodCBvZiB0aGlzIGNhbnZhcy5cblx0XHQgKiBAcHJvcGVydHkgaGVpZ2h0XG5cdFx0ICogQHR5cGUge051bWJlcn1cblx0XHQgKi9cblx0XHR0aGlzLmhlaWdodCA9IHRoaXMudmlldy5oZWlnaHQgPSBoZWlnaHQgfHwgMTUwO1xuXG5cblx0XHQvKipcblx0XHQgKiBUaGUgY29udGV4dCBhdHRyaWJ1dGVzIGZvciBpbml0aWFsaXppbmcgdGhlIEdMIHN0YXRlLiBUaGlzIG1pZ2h0IGluY2x1ZGVcblx0XHQgKiBhbnRpLWFsaWFzaW5nLCBhbHBoYSBzZXR0aW5ncywgdmVyaXNvbiwgYW5kIHNvIGZvcnRoLlxuXHRcdCAqIFxuXHRcdCAqIEBwcm9wZXJ0eSB7T2JqZWN0fSBjb250ZXh0QXR0cmlidXRlcyBcblx0XHQgKi9cblx0XHR0aGlzLmNvbnRleHRBdHRyaWJ1dGVzID0gY29udGV4dEF0dHJpYnV0ZXM7XG5cdFx0XG5cdFx0LyoqXG5cdFx0ICogV2hldGhlciB0aGlzIGNvbnRleHQgaXMgJ3ZhbGlkJywgaS5lLiByZW5kZXJhYmxlLiBBIGNvbnRleHQgdGhhdCBoYXMgYmVlbiBsb3N0XG5cdFx0ICogKGFuZCBub3QgeWV0IHJlc3RvcmVkKSBvciBkZXN0cm95ZWQgaXMgaW52YWxpZC5cblx0XHQgKiBcblx0XHQgKiBAcHJvcGVydHkge0Jvb2xlYW59IHZhbGlkXG5cdFx0ICovXG5cdFx0dGhpcy52YWxpZCA9IGZhbHNlO1xuXG5cdFx0LyoqXG5cdFx0ICogQSBzaWduYWwgZGlzcGF0Y2hlZCB3aGVuIEdMIGNvbnRleHQgaXMgbG9zdC4gXG5cdFx0ICogXG5cdFx0ICogVGhlIGZpcnN0IGFyZ3VtZW50IHBhc3NlZCB0byB0aGUgbGlzdGVuZXIgaXMgdGhlIFdlYkdMQ29udGV4dFxuXHRcdCAqIG1hbmFnaW5nIHRoZSBjb250ZXh0IGxvc3MuXG5cdFx0ICogXG5cdFx0ICogQGV2ZW50IHtTaWduYWx9IGxvc3Rcblx0XHQgKi9cblx0XHR0aGlzLmxvc3QgPSBuZXcgU2lnbmFsKCk7XG5cblx0XHQvKipcblx0XHQgKiBBIHNpZ25hbCBkaXNwYXRjaGVkIHdoZW4gR0wgY29udGV4dCBpcyByZXN0b3JlZCwgYWZ0ZXIgYWxsIHRoZSBtYW5hZ2VkXG5cdFx0ICogb2JqZWN0cyBoYXZlIGJlZW4gcmVjcmVhdGVkLlxuXHRcdCAqXG5cdFx0ICogVGhlIGZpcnN0IGFyZ3VtZW50IHBhc3NlZCB0byB0aGUgbGlzdGVuZXIgaXMgdGhlIFdlYkdMQ29udGV4dFxuXHRcdCAqIHdoaWNoIG1hbmFnZWQgdGhlIHJlc3RvcmF0aW9uLlxuXHRcdCAqXG5cdFx0ICogVGhpcyBkb2VzIG5vdCBnYXVyZW50ZWUgdGhhdCBhbGwgb2JqZWN0cyB3aWxsIGJlIHJlbmRlcmFibGUuXG5cdFx0ICogRm9yIGV4YW1wbGUsIGEgVGV4dHVyZSB3aXRoIGFuIEltYWdlUHJvdmlkZXIgbWF5IHN0aWxsIGJlIGxvYWRpbmdcblx0XHQgKiBhc3luY2hyb25vdXNseS5cdCBcblx0XHQgKiBcblx0XHQgKiBAZXZlbnQge1NpZ25hbH0gcmVzdG9yZWRcblx0XHQgKi9cblx0XHR0aGlzLnJlc3RvcmVkID0gbmV3IFNpZ25hbCgpO1x0XG5cdFx0XG5cdFx0Ly9zZXR1cCBjb250ZXh0IGxvc3QgYW5kIHJlc3RvcmUgbGlzdGVuZXJzXG5cdFx0dGhpcy52aWV3LmFkZEV2ZW50TGlzdGVuZXIoXCJ3ZWJnbGNvbnRleHRsb3N0XCIsIGZ1bmN0aW9uIChldikge1xuXHRcdFx0ZXYucHJldmVudERlZmF1bHQoKTtcblx0XHRcdHRoaXMuX2NvbnRleHRMb3N0KGV2KTtcblx0XHR9LmJpbmQodGhpcykpO1xuXHRcdHRoaXMudmlldy5hZGRFdmVudExpc3RlbmVyKFwid2ViZ2xjb250ZXh0cmVzdG9yZWRcIiwgZnVuY3Rpb24gKGV2KSB7XG5cdFx0XHRldi5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0dGhpcy5fY29udGV4dFJlc3RvcmVkKGV2KTtcblx0XHR9LmJpbmQodGhpcykpO1xuXHRcdFx0XG5cdFx0dGhpcy5faW5pdENvbnRleHQoKTtcblxuXHRcdHRoaXMucmVzaXplKHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0KTtcblx0fSxcblx0XG5cdF9pbml0Q29udGV4dDogZnVuY3Rpb24oKSB7XG5cdFx0dmFyIGVyciA9IFwiXCI7XG5cdFx0dGhpcy52YWxpZCA9IGZhbHNlO1xuXG5cdFx0dHJ5IHtcblx0XHRcdHRoaXMuZ2wgPSAodGhpcy52aWV3LmdldENvbnRleHQoJ3dlYmdsJywgdGhpcy5jb250ZXh0QXR0cmlidXRlcykgXG5cdFx0XHRcdFx0XHR8fCB0aGlzLnZpZXcuZ2V0Q29udGV4dCgnZXhwZXJpbWVudGFsLXdlYmdsJywgdGhpcy5jb250ZXh0QXR0cmlidXRlcykpO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHRoaXMuZ2wgPSBudWxsO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmdsKSB7XG5cdFx0XHR0aGlzLnZhbGlkID0gdHJ1ZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhyb3cgXCJXZWJHTCBDb250ZXh0IE5vdCBTdXBwb3J0ZWQgLS0gdHJ5IGVuYWJsaW5nIGl0IG9yIHVzaW5nIGEgZGlmZmVyZW50IGJyb3dzZXJcIjtcblx0XHR9XHRcblx0fSxcblxuXHQvKipcblx0ICogVXBkYXRlcyB0aGUgd2lkdGggYW5kIGhlaWdodCBvZiB0aGlzIFdlYkdMIGNvbnRleHQsIHJlc2l6ZXNcblx0ICogdGhlIGNhbnZhcyB2aWV3LCBhbmQgY2FsbHMgZ2wudmlld3BvcnQoKSB3aXRoIHRoZSBuZXcgc2l6ZS5cblx0ICogXG5cdCAqIEBwYXJhbSAge051bWJlcn0gd2lkdGggIHRoZSBuZXcgd2lkdGhcblx0ICogQHBhcmFtICB7TnVtYmVyfSBoZWlnaHQgdGhlIG5ldyBoZWlnaHRcblx0ICovXG5cdHJlc2l6ZTogZnVuY3Rpb24od2lkdGgsIGhlaWdodCkge1xuXHRcdHRoaXMud2lkdGggPSB3aWR0aDtcblx0XHR0aGlzLmhlaWdodCA9IGhlaWdodDtcblxuXHRcdHRoaXMudmlldy53aWR0aCA9IHdpZHRoO1xuXHRcdHRoaXMudmlldy5oZWlnaHQgPSBoZWlnaHQ7XG5cblx0XHR2YXIgZ2wgPSB0aGlzLmdsO1xuXHRcdGdsLnZpZXdwb3J0KDAsIDAsIHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0KTtcblx0fSxcblxuXHQvKipcblx0ICogKGludGVybmFsIHVzZSlcblx0ICogQSBtYW5hZ2VkIG9iamVjdCBpcyBhbnl0aGluZyB3aXRoIGEgXCJjcmVhdGVcIiBmdW5jdGlvbiwgdGhhdCB3aWxsXG5cdCAqIHJlc3RvcmUgR0wgc3RhdGUgYWZ0ZXIgY29udGV4dCBsb3NzLiBcblx0ICogXG5cdCAqIEBwYXJhbSB7W3R5cGVdfSB0ZXggW2Rlc2NyaXB0aW9uXVxuXHQgKi9cblx0YWRkTWFuYWdlZE9iamVjdDogZnVuY3Rpb24ob2JqKSB7XG5cdFx0dGhpcy5tYW5hZ2VkT2JqZWN0cy5wdXNoKG9iaik7XG5cdH0sXG5cblx0LyoqXG5cdCAqIChpbnRlcm5hbCB1c2UpXG5cdCAqIFJlbW92ZXMgYSBtYW5hZ2VkIG9iamVjdCBmcm9tIHRoZSBjYWNoZS4gVGhpcyBpcyB1c2VmdWwgdG8gZGVzdHJveVxuXHQgKiBhIHRleHR1cmUgb3Igc2hhZGVyLCBhbmQgaGF2ZSBpdCBubyBsb25nZXIgcmUtbG9hZCBvbiBjb250ZXh0IHJlc3RvcmUuXG5cdCAqXG5cdCAqIFJldHVybnMgdGhlIG9iamVjdCB0aGF0IHdhcyByZW1vdmVkLCBvciBudWxsIGlmIGl0IHdhcyBub3QgZm91bmQgaW4gdGhlIGNhY2hlLlxuXHQgKiBcblx0ICogQHBhcmFtICB7T2JqZWN0fSBvYmogdGhlIG9iamVjdCB0byBiZSBtYW5hZ2VkXG5cdCAqIEByZXR1cm4ge09iamVjdH0gICAgIHRoZSByZW1vdmVkIG9iamVjdCwgb3IgbnVsbFxuXHQgKi9cblx0cmVtb3ZlTWFuYWdlZE9iamVjdDogZnVuY3Rpb24ob2JqKSB7XG5cdFx0dmFyIGlkeCA9IHRoaXMubWFuYWdlZE9iamVjdHMuaW5kZXhPZihvYmopO1xuXHRcdGlmIChpZHggPiAtMSkge1xuXHRcdFx0dGhpcy5tYW5hZ2VkT2JqZWN0cy5zcGxpY2UoaWR4LCAxKTtcblx0XHRcdHJldHVybiBvYmo7XG5cdFx0fSBcblx0XHRyZXR1cm4gbnVsbDtcblx0fSxcblxuXHQvKipcblx0ICogQ2FsbHMgZGVzdHJveSgpIG9uIGVhY2ggbWFuYWdlZCBvYmplY3QsIHRoZW4gcmVtb3ZlcyByZWZlcmVuY2VzIHRvIHRoZXNlIG9iamVjdHNcblx0ICogYW5kIHRoZSBHTCByZW5kZXJpbmcgY29udGV4dC4gVGhpcyBhbHNvIHJlbW92ZXMgcmVmZXJlbmNlcyB0byB0aGUgdmlldyBhbmQgc2V0c1xuXHQgKiB0aGUgY29udGV4dCdzIHdpZHRoIGFuZCBoZWlnaHQgdG8gemVyby5cblx0ICpcblx0ICogQXR0ZW1wdGluZyB0byB1c2UgdGhpcyBXZWJHTENvbnRleHQgb3IgdGhlIEdMIHJlbmRlcmluZyBjb250ZXh0IGFmdGVyIGRlc3Ryb3lpbmcgaXRcblx0ICogd2lsbCBsZWFkIHRvIHVuZGVmaW5lZCBiZWhhdmlvdXIuXG5cdCAqL1xuXHRkZXN0cm95OiBmdW5jdGlvbigpIHtcblx0XHRmb3IgKHZhciBpPTA7IGk8dGhpcy5tYW5hZ2VkT2JqZWN0cy5sZW5ndGg7IGkrKykge1xuXHRcdFx0dmFyIG9iaiA9IHRoaXMubWFuYWdlZE9iamVjdHNbaV07XG5cdFx0XHRpZiAob2JqICYmIHR5cGVvZiBvYmouZGVzdHJveSlcblx0XHRcdFx0b2JqLmRlc3Ryb3koKTtcblx0XHR9XG5cdFx0dGhpcy5tYW5hZ2VkT2JqZWN0cy5sZW5ndGggPSAwO1xuXHRcdHRoaXMudmFsaWQgPSBmYWxzZTtcblx0XHR0aGlzLmdsID0gbnVsbDtcblx0XHR0aGlzLnZpZXcgPSBudWxsO1xuXHRcdHRoaXMud2lkdGggPSB0aGlzLmhlaWdodCA9IDA7XG5cdH0sXG5cblx0X2NvbnRleHRMb3N0OiBmdW5jdGlvbihldikge1xuXHRcdC8vYWxsIHRleHR1cmVzL3NoYWRlcnMvYnVmZmVycy9GQk9zIGhhdmUgYmVlbiBkZWxldGVkLi4uIFxuXHRcdC8vd2UgbmVlZCB0byByZS1jcmVhdGUgdGhlbSBvbiByZXN0b3JlXG5cdFx0dGhpcy52YWxpZCA9IGZhbHNlO1xuXG5cdFx0dGhpcy5sb3N0LmRpc3BhdGNoKHRoaXMpO1xuXHR9LFxuXG5cdF9jb250ZXh0UmVzdG9yZWQ6IGZ1bmN0aW9uKGV2KSB7XG5cdFx0Ly9maXJzdCwgaW5pdGlhbGl6ZSB0aGUgR0wgY29udGV4dCBhZ2FpblxuXHRcdHRoaXMuX2luaXRDb250ZXh0KCk7XG5cblx0XHQvL25vdyB3ZSByZWNyZWF0ZSBvdXIgc2hhZGVycyBhbmQgdGV4dHVyZXNcblx0XHRmb3IgKHZhciBpPTA7IGk8dGhpcy5tYW5hZ2VkT2JqZWN0cy5sZW5ndGg7IGkrKykge1xuXHRcdFx0dGhpcy5tYW5hZ2VkT2JqZWN0c1tpXS5jcmVhdGUoKTtcblx0XHR9XG5cblx0XHQvL3VwZGF0ZSBHTCB2aWV3cG9ydFxuXHRcdHRoaXMucmVzaXplKHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0KTtcblxuXHRcdHRoaXMucmVzdG9yZWQuZGlzcGF0Y2godGhpcyk7XG5cdH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFdlYkdMQ29udGV4dDsiLCJ2YXIgQ2xhc3MgPSByZXF1aXJlKCdrbGFzc2UnKTtcbnZhciBUZXh0dXJlID0gcmVxdWlyZSgnLi4vVGV4dHVyZScpO1xuXG5cbnZhciBGcmFtZUJ1ZmZlciA9IG5ldyBDbGFzcyh7XG5cblx0LyoqXG5cdCAqIENyZWF0ZXMgYSBuZXcgRnJhbWUgQnVmZmVyIE9iamVjdCB3aXRoIHRoZSBnaXZlbiB3aWR0aCBhbmQgaGVpZ2h0LlxuXHQgKlxuXHQgKiBJZiB3aWR0aCBhbmQgaGVpZ2h0IGFyZSBub24tbnVtYmVycywgdGhpcyBtZXRob2QgZXhwZWN0cyB0aGVcblx0ICogZmlyc3QgcGFyYW1ldGVyIHRvIGJlIGEgVGV4dHVyZSBvYmplY3Qgd2hpY2ggc2hvdWxkIGJlIGFjdGVkIHVwb24uIFxuXHQgKiBJbiB0aGlzIGNhc2UsIHRoZSBGcmFtZUJ1ZmZlciBkb2VzIG5vdCBcIm93blwiIHRoZSB0ZXh0dXJlLCBhbmQgc28gaXRcblx0ICogd29uJ3QgZGlzcG9zZSBvZiBpdCB1cG9uIGRlc3RydWN0aW9uLiBUaGlzIGlzIGFuIGFkdmFuY2VkIHZlcnNpb24gb2YgdGhlXG5cdCAqIGNvbnN0cnVjdG9yIHRoYXQgYXNzdW1lcyB0aGUgdXNlciBpcyBnaXZpbmcgdXMgYSB2YWxpZCBUZXh0dXJlIHRoYXQgY2FuIGJlIGJvdW5kIChpLmUuXG5cdCAqIG5vIGFzeW5jIEltYWdlIHRleHR1cmVzKS5cblx0ICogXG5cdCAqIEBwYXJhbSAge1t0eXBlXX0gd2lkdGggIFtkZXNjcmlwdGlvbl1cblx0ICogQHBhcmFtICB7W3R5cGVdfSBoZWlnaHQgW2Rlc2NyaXB0aW9uXVxuXHQgKiBAcGFyYW0gIHtbdHlwZV19IGZpbHRlciBbZGVzY3JpcHRpb25dXG5cdCAqIEByZXR1cm4ge1t0eXBlXX0gICAgICAgIFtkZXNjcmlwdGlvbl1cblx0ICovXG5cdGluaXRpYWxpemU6IGZ1bmN0aW9uIEZyYW1lQnVmZmVyKGNvbnRleHQsIHdpZHRoLCBoZWlnaHQsIGZvcm1hdCkgeyAvL1RPRE86IGRlcHRoIGNvbXBvbmVudFxuXHRcdGlmICh0eXBlb2YgY29udGV4dCAhPT0gXCJvYmplY3RcIilcblx0XHRcdHRocm93IFwiR0wgY29udGV4dCBub3Qgc3BlY2lmaWVkIHRvIEZyYW1lQnVmZmVyXCI7XG5cdFx0dGhpcy5pZCA9IG51bGw7XG5cdFx0dGhpcy5jb250ZXh0ID0gY29udGV4dDtcblxuXHRcdC8vdGhpcyBUZXh0dXJlIGlzIG5vdyBtYW5hZ2VkLlxuXHRcdHRoaXMudGV4dHVyZSA9IG5ldyBUZXh0dXJlKGNvbnRleHQsIHdpZHRoLCBoZWlnaHQsIGZvcm1hdCk7XG5cblx0XHQvL1RoaXMgaXMgbWFhbmdlZCBieSBXZWJHTENvbnRleHRcblx0XHR0aGlzLmNvbnRleHQuYWRkTWFuYWdlZE9iamVjdCh0aGlzKTtcblx0XHR0aGlzLmNyZWF0ZSgpO1xuXHR9LFxuXG5cdHdpZHRoOiB7XG5cdFx0Z2V0OiBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiB0aGlzLnRleHR1cmUud2lkdGhcblx0XHR9XG5cdH0sXG5cblx0aGVpZ2h0OiB7XG5cdFx0Z2V0OiBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiB0aGlzLnRleHR1cmUuaGVpZ2h0O1xuXHRcdH1cblx0fSxcblxuXHRjcmVhdGU6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMuZ2wgPSB0aGlzLmNvbnRleHQuZ2w7IFxuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cblx0XHR2YXIgdGV4ID0gdGhpcy50ZXh0dXJlO1xuXG5cdFx0Ly93ZSBhc3N1bWUgdGhlIHRleHR1cmUgaGFzIGFscmVhZHkgaGFkIGNyZWF0ZSgpIGNhbGxlZCBvbiBpdFxuXHRcdC8vc2luY2UgaXQgd2FzIGFkZGVkIGFzIGEgbWFuYWdlZCBvYmplY3QgcHJpb3IgdG8gdGhpcyBGcmFtZUJ1ZmZlclxuXHRcdHRleC5iaW5kKCk7XG4gXG5cdFx0dGhpcy5pZCA9IGdsLmNyZWF0ZUZyYW1lYnVmZmVyKCk7XG5cdFx0Z2wuYmluZEZyYW1lYnVmZmVyKGdsLkZSQU1FQlVGRkVSLCB0aGlzLmlkKTtcblxuXHRcdGdsLmZyYW1lYnVmZmVyVGV4dHVyZTJEKGdsLkZSQU1FQlVGRkVSLCBnbC5DT0xPUl9BVFRBQ0hNRU5UMCwgdGV4LnRhcmdldCwgdGV4LmlkLCAwKTtcblxuXHRcdHZhciByZXN1bHQgPSBnbC5jaGVja0ZyYW1lYnVmZmVyU3RhdHVzKGdsLkZSQU1FQlVGRkVSKTtcblx0XHRpZiAocmVzdWx0ICE9IGdsLkZSQU1FQlVGRkVSX0NPTVBMRVRFKSB7XG5cdFx0XHR0aGlzLmRlc3Ryb3koKTsgLy9kZXN0cm95IG91ciByZXNvdXJjZXMgYmVmb3JlIGxlYXZpbmcgdGhpcyBmdW5jdGlvbi4uXG5cblx0XHRcdHZhciBlcnIgPSBcIkZyYW1lYnVmZmVyIG5vdCBjb21wbGV0ZVwiO1xuXHRcdFx0c3dpdGNoIChyZXN1bHQpIHtcblx0XHRcdFx0Y2FzZSBnbC5GUkFNRUJVRkZFUl9VTlNVUFBPUlRFRDpcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoZXJyICsgXCI6IHVuc3VwcG9ydGVkXCIpO1xuXHRcdFx0XHRjYXNlIGdsLklOQ09NUExFVEVfRElNRU5TSU9OUzpcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoZXJyICsgXCI6IGluY29tcGxldGUgZGltZW5zaW9uc1wiKTtcblx0XHRcdFx0Y2FzZSBnbC5JTkNPTVBMRVRFX0FUVEFDSE1FTlQ6XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGVyciArIFwiOiBpbmNvbXBsZXRlIGF0dGFjaG1lbnRcIik7XG5cdFx0XHRcdGNhc2UgZ2wuSU5DT01QTEVURV9NSVNTSU5HX0FUVEFDSE1FTlQ6XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGVyciArIFwiOiBtaXNzaW5nIGF0dGFjaG1lbnRcIik7XG5cdFx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGVycik7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgbnVsbCk7XG5cdH0sXG5cblx0ZGVzdHJveTogZnVuY3Rpb24oKSB7XG5cdFx0dmFyIGdsID0gdGhpcy5nbDtcblxuXHRcdGlmICh0aGlzLnRleHR1cmUpXG5cdFx0XHR0aGlzLnRleHR1cmUuZGVzdHJveSgpO1xuXHRcdGlmICh0aGlzLmlkICYmIHRoaXMuZ2wpXG5cdFx0XHR0aGlzLmdsLmRlbGV0ZUZyYW1lYnVmZmVyKHRoaXMuaWQpO1xuXHRcdGlmICh0aGlzLmNvbnRleHQpXG5cdFx0XHR0aGlzLmNvbnRleHQucmVtb3ZlTWFuYWdlZE9iamVjdCh0aGlzKTtcblxuXHRcdHRoaXMuaWQgPSBudWxsO1xuXHRcdHRoaXMudGV4dHVyZSA9IG51bGw7XG5cdH0sXG5cblx0YmVnaW46IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cdFx0Z2wudmlld3BvcnQoMCwgMCwgdGhpcy50ZXh0dXJlLndpZHRoLCB0aGlzLnRleHR1cmUuaGVpZ2h0KTtcblx0XHRnbC5iaW5kRnJhbWVidWZmZXIoZ2wuRlJBTUVCVUZGRVIsIHRoaXMuaWQpO1xuXHR9LFxuXG5cdGVuZDogZnVuY3Rpb24oKSB7XG5cdFx0dmFyIGdsID0gdGhpcy5nbDtcblx0XHRnbC52aWV3cG9ydCgwLCAwLCB0aGlzLmNvbnRleHQud2lkdGgsIHRoaXMuY29udGV4dC5oZWlnaHQpO1xuXHRcdGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgbnVsbCk7XG5cdH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEZyYW1lQnVmZmVyOyIsIi8qKlxuICogQG1vZHVsZSBrYW1pXG4gKi9cblxudmFyIENsYXNzID0gcmVxdWlyZSgna2xhc3NlJyk7XG5cbi8vVE9ETzogZGVjb3VwbGUgaW50byBWQk8gKyBJQk8gdXRpbGl0aWVzIFxuLyoqXG4gKiBBIG1lc2ggY2xhc3MgdGhhdCB3cmFwcyBWQk8gYW5kIElCTy5cbiAqXG4gKiBAY2xhc3MgIE1lc2hcbiAqL1xudmFyIE1lc2ggPSBuZXcgQ2xhc3Moe1xuXG5cblx0LyoqXG5cdCAqIEEgd3JpdGUtb25seSBwcm9wZXJ0eSB3aGljaCBzZXRzIGJvdGggdmVydGljZXMgYW5kIGluZGljZXMgXG5cdCAqIGZsYWcgdG8gZGlydHkgb3Igbm90LiBcblx0ICpcblx0ICogQHByb3BlcnR5IGRpcnR5XG5cdCAqIEB0eXBlIHtCb29sZWFufVxuXHQgKiBAd3JpdGVPbmx5XG5cdCAqL1xuXHRkaXJ0eToge1xuXHRcdHNldDogZnVuY3Rpb24odmFsKSB7XG5cdFx0XHR0aGlzLnZlcnRpY2VzRGlydHkgPSB2YWw7XG5cdFx0XHR0aGlzLmluZGljZXNEaXJ0eSA9IHZhbDtcblx0XHR9XG5cdH0sXG5cblx0LyoqXG5cdCAqIENyZWF0ZXMgYSBuZXcgTWVzaCB3aXRoIHRoZSBwcm92aWRlZCBwYXJhbWV0ZXJzLlxuXHQgKlxuXHQgKiBJZiBudW1JbmRpY2VzIGlzIDAgb3IgZmFsc3ksIG5vIGluZGV4IGJ1ZmZlciB3aWxsIGJlIHVzZWRcblx0ICogYW5kIGluZGljZXMgd2lsbCBiZSBhbiBlbXB0eSBBcnJheUJ1ZmZlciBhbmQgYSBudWxsIGluZGV4QnVmZmVyLlxuXHQgKiBcblx0ICogSWYgaXNTdGF0aWMgaXMgdHJ1ZSwgdGhlbiB2ZXJ0ZXhVc2FnZSBhbmQgaW5kZXhVc2FnZSB3aWxsXG5cdCAqIGJlIHNldCB0byBnbC5TVEFUSUNfRFJBVy4gT3RoZXJ3aXNlIHRoZXkgd2lsbCB1c2UgZ2wuRFlOQU1JQ19EUkFXLlxuXHQgKiBZb3UgbWF5IHdhbnQgdG8gYWRqdXN0IHRoZXNlIGFmdGVyIGluaXRpYWxpemF0aW9uIGZvciBmdXJ0aGVyIGNvbnRyb2wuXG5cdCAqIFxuXHQgKiBAcGFyYW0gIHtXZWJHTENvbnRleHR9ICBjb250ZXh0IHRoZSBjb250ZXh0IGZvciBtYW5hZ2VtZW50XG5cdCAqIEBwYXJhbSAge0Jvb2xlYW59IGlzU3RhdGljICAgICAgYSBoaW50IGFzIHRvIHdoZXRoZXIgdGhpcyBnZW9tZXRyeSBpcyBzdGF0aWNcblx0ICogQHBhcmFtICB7W3R5cGVdfSAgbnVtVmVydHMgICAgICBbZGVzY3JpcHRpb25dXG5cdCAqIEBwYXJhbSAge1t0eXBlXX0gIG51bUluZGljZXMgICAgW2Rlc2NyaXB0aW9uXVxuXHQgKiBAcGFyYW0gIHtbdHlwZV19ICB2ZXJ0ZXhBdHRyaWJzIFtkZXNjcmlwdGlvbl1cblx0ICogQHJldHVybiB7W3R5cGVdfSAgICAgICAgICAgICAgICBbZGVzY3JpcHRpb25dXG5cdCAqL1xuXHRpbml0aWFsaXplOiBmdW5jdGlvbiBNZXNoKGNvbnRleHQsIGlzU3RhdGljLCBudW1WZXJ0cywgbnVtSW5kaWNlcywgdmVydGV4QXR0cmlicykge1xuXHRcdGlmICh0eXBlb2YgY29udGV4dCAhPT0gXCJvYmplY3RcIilcblx0XHRcdHRocm93IFwiR0wgY29udGV4dCBub3Qgc3BlY2lmaWVkIHRvIE1lc2hcIjtcblx0XHRpZiAoIW51bVZlcnRzKVxuXHRcdFx0dGhyb3cgXCJudW1WZXJ0cyBub3Qgc3BlY2lmaWVkLCBtdXN0IGJlID4gMFwiO1xuXG5cdFx0dGhpcy5jb250ZXh0ID0gY29udGV4dDtcblx0XHR0aGlzLmdsID0gY29udGV4dC5nbDtcblx0XHRcblx0XHR0aGlzLm51bVZlcnRzID0gbnVsbDtcblx0XHR0aGlzLm51bUluZGljZXMgPSBudWxsO1xuXHRcdFxuXHRcdHRoaXMudmVydGljZXMgPSBudWxsO1xuXHRcdHRoaXMuaW5kaWNlcyA9IG51bGw7XG5cdFx0dGhpcy52ZXJ0ZXhCdWZmZXIgPSBudWxsO1xuXHRcdHRoaXMuaW5kZXhCdWZmZXIgPSBudWxsO1xuXG5cdFx0dGhpcy52ZXJ0aWNlc0RpcnR5ID0gdHJ1ZTtcblx0XHR0aGlzLmluZGljZXNEaXJ0eSA9IHRydWU7XG5cdFx0dGhpcy5pbmRleFVzYWdlID0gbnVsbDtcblx0XHR0aGlzLnZlcnRleFVzYWdlID0gbnVsbDtcblxuXHRcdC8qKiBcblx0XHQgKiBAcHJvcGVydHlcblx0XHQgKiBAcHJpdmF0ZVxuXHRcdCAqL1xuXHRcdHRoaXMuX3ZlcnRleEF0dHJpYnMgPSBudWxsO1xuXG5cdFx0LyoqIFxuXHRcdCAqIEBwcm9wZXJ0eVxuXHRcdCAqIEBwcml2YXRlXG5cdFx0ICovXG5cdFx0dGhpcy5fdmVydGV4U3RyaWRlID0gbnVsbDtcblxuXHRcdHRoaXMubnVtVmVydHMgPSBudW1WZXJ0cztcblx0XHR0aGlzLm51bUluZGljZXMgPSBudW1JbmRpY2VzIHx8IDA7XG5cdFx0dGhpcy52ZXJ0ZXhVc2FnZSA9IGlzU3RhdGljID8gdGhpcy5nbC5TVEFUSUNfRFJBVyA6IHRoaXMuZ2wuRFlOQU1JQ19EUkFXO1xuXHRcdHRoaXMuaW5kZXhVc2FnZSAgPSBpc1N0YXRpYyA/IHRoaXMuZ2wuU1RBVElDX0RSQVcgOiB0aGlzLmdsLkRZTkFNSUNfRFJBVztcblx0XHR0aGlzLl92ZXJ0ZXhBdHRyaWJzID0gdmVydGV4QXR0cmlicyB8fCBbXTtcblx0XHRcblx0XHR0aGlzLmluZGljZXNEaXJ0eSA9IHRydWU7XG5cdFx0dGhpcy52ZXJ0aWNlc0RpcnR5ID0gdHJ1ZTtcblxuXHRcdC8vZGV0ZXJtaW5lIHRoZSB2ZXJ0ZXggc3RyaWRlIGJhc2VkIG9uIGdpdmVuIGF0dHJpYnV0ZXNcblx0XHR2YXIgdG90YWxOdW1Db21wb25lbnRzID0gMDtcblx0XHRmb3IgKHZhciBpPTA7IGk8dGhpcy5fdmVydGV4QXR0cmlicy5sZW5ndGg7IGkrKylcblx0XHRcdHRvdGFsTnVtQ29tcG9uZW50cyArPSB0aGlzLl92ZXJ0ZXhBdHRyaWJzW2ldLm9mZnNldENvdW50O1xuXHRcdHRoaXMuX3ZlcnRleFN0cmlkZSA9IHRvdGFsTnVtQ29tcG9uZW50cyAqIDQ7IC8vIGluIGJ5dGVzXG5cblx0XHR0aGlzLnZlcnRpY2VzID0gbmV3IEZsb2F0MzJBcnJheSh0aGlzLm51bVZlcnRzKTtcblx0XHR0aGlzLmluZGljZXMgPSBuZXcgVWludDE2QXJyYXkodGhpcy5udW1JbmRpY2VzKTtcblxuXHRcdC8vYWRkIHRoaXMgVkJPIHRvIHRoZSBtYW5hZ2VkIGNhY2hlXG5cdFx0dGhpcy5jb250ZXh0LmFkZE1hbmFnZWRPYmplY3QodGhpcyk7XG5cblx0XHR0aGlzLmNyZWF0ZSgpO1xuXHR9LFxuXG5cdC8vcmVjcmVhdGVzIHRoZSBidWZmZXJzIG9uIGNvbnRleHQgbG9zc1xuXHRjcmVhdGU6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMuZ2wgPSB0aGlzLmNvbnRleHQuZ2w7XG5cdFx0dmFyIGdsID0gdGhpcy5nbDtcblx0XHR0aGlzLnZlcnRleEJ1ZmZlciA9IGdsLmNyZWF0ZUJ1ZmZlcigpO1xuXG5cdFx0Ly9pZ25vcmUgaW5kZXggYnVmZmVyIGlmIHdlIGhhdmVuJ3Qgc3BlY2lmaWVkIGFueVxuXHRcdHRoaXMuaW5kZXhCdWZmZXIgPSB0aGlzLm51bUluZGljZXMgPiAwXG5cdFx0XHRcdFx0PyBnbC5jcmVhdGVCdWZmZXIoKVxuXHRcdFx0XHRcdDogbnVsbDtcblxuXHRcdHRoaXMuZGlydHkgPSB0cnVlO1xuXHR9LFxuXG5cdGRlc3Ryb3k6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMudmVydGljZXMgPSBbXTtcblx0XHR0aGlzLmluZGljZXMgPSBbXTtcblx0XHRpZiAodGhpcy52ZXJ0ZXhCdWZmZXIgJiYgdGhpcy5nbClcblx0XHRcdHRoaXMuZ2wuZGVsZXRlQnVmZmVyKHRoaXMudmVydGV4QnVmZmVyKTtcblx0XHRpZiAodGhpcy5pbmRleEJ1ZmZlciAmJiB0aGlzLmdsKVxuXHRcdFx0dGhpcy5nbC5kZWxldGVCdWZmZXIodGhpcy5pbmRleEJ1ZmZlcik7XG5cdFx0dGhpcy52ZXJ0ZXhCdWZmZXIgPSBudWxsO1xuXHRcdHRoaXMuaW5kZXhCdWZmZXIgPSBudWxsO1xuXHRcdGlmICh0aGlzLmNvbnRleHQpXG5cdFx0XHR0aGlzLmNvbnRleHQucmVtb3ZlTWFuYWdlZE9iamVjdCh0aGlzKTtcblx0XHR0aGlzLmdsID0gbnVsbDtcblx0XHR0aGlzLmNvbnRleHQgPSBudWxsO1xuXHR9LFxuXG5cdF91cGRhdGVCdWZmZXJzOiBmdW5jdGlvbihpZ25vcmVCaW5kLCBzdWJEYXRhTGVuZ3RoKSB7XG5cdFx0dmFyIGdsID0gdGhpcy5nbDtcblxuXHRcdC8vYmluZCBvdXIgaW5kZXggZGF0YSwgaWYgd2UgaGF2ZSBhbnlcblx0XHRpZiAodGhpcy5udW1JbmRpY2VzID4gMCkge1xuXHRcdFx0aWYgKCFpZ25vcmVCaW5kKVxuXHRcdFx0XHRnbC5iaW5kQnVmZmVyKGdsLkVMRU1FTlRfQVJSQVlfQlVGRkVSLCB0aGlzLmluZGV4QnVmZmVyKTtcblxuXHRcdFx0Ly91cGRhdGUgdGhlIGluZGV4IGRhdGFcblx0XHRcdGlmICh0aGlzLmluZGljZXNEaXJ0eSkge1xuXHRcdFx0XHRnbC5idWZmZXJEYXRhKGdsLkVMRU1FTlRfQVJSQVlfQlVGRkVSLCB0aGlzLmluZGljZXMsIHRoaXMuaW5kZXhVc2FnZSk7XG5cdFx0XHRcdHRoaXMuaW5kaWNlc0RpcnR5ID0gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly9iaW5kIG91ciB2ZXJ0ZXggZGF0YVxuXHRcdGlmICghaWdub3JlQmluZClcblx0XHRcdGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCB0aGlzLnZlcnRleEJ1ZmZlcik7XG5cblx0XHQvL3VwZGF0ZSBvdXIgdmVydGV4IGRhdGFcblx0XHRpZiAodGhpcy52ZXJ0aWNlc0RpcnR5KSB7XG5cdFx0XHRpZiAoc3ViRGF0YUxlbmd0aCkge1xuXHRcdFx0XHQvLyBUT0RPOiBXaGVuIGRlY291cGxpbmcgVkJPL0lCTyBiZSBzdXJlIHRvIGdpdmUgYmV0dGVyIHN1YkRhdGEgc3VwcG9ydC4uXG5cdFx0XHRcdHZhciB2aWV3ID0gdGhpcy52ZXJ0aWNlcy5zdWJhcnJheSgwLCBzdWJEYXRhTGVuZ3RoKTtcblx0XHRcdFx0Z2wuYnVmZmVyU3ViRGF0YShnbC5BUlJBWV9CVUZGRVIsIDAsIHZpZXcpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Z2wuYnVmZmVyRGF0YShnbC5BUlJBWV9CVUZGRVIsIHRoaXMudmVydGljZXMsIHRoaXMudmVydGV4VXNhZ2UpO1x0XG5cdFx0XHR9XG5cblx0XHRcdFxuXHRcdFx0dGhpcy52ZXJ0aWNlc0RpcnR5ID0gZmFsc2U7XG5cdFx0fVxuXHR9LFxuXG5cdGRyYXc6IGZ1bmN0aW9uKHByaW1pdGl2ZVR5cGUsIGNvdW50LCBvZmZzZXQsIHN1YkRhdGFMZW5ndGgpIHtcblx0XHRpZiAoY291bnQgPT09IDApXG5cdFx0XHRyZXR1cm47XG5cblx0XHR2YXIgZ2wgPSB0aGlzLmdsO1xuXHRcdFxuXHRcdG9mZnNldCA9IG9mZnNldCB8fCAwO1xuXG5cdFx0Ly9iaW5kcyBhbmQgdXBkYXRlcyBvdXIgYnVmZmVycy4gcGFzcyBpZ25vcmVCaW5kIGFzIHRydWVcblx0XHQvL3RvIGF2b2lkIGJpbmRpbmcgdW5uZWNlc3NhcmlseVxuXHRcdHRoaXMuX3VwZGF0ZUJ1ZmZlcnModHJ1ZSwgc3ViRGF0YUxlbmd0aCk7XG5cblx0XHRpZiAodGhpcy5udW1JbmRpY2VzID4gMCkgeyBcblx0XHRcdGdsLmRyYXdFbGVtZW50cyhwcmltaXRpdmVUeXBlLCBjb3VudCwgXG5cdFx0XHRcdFx0XHRnbC5VTlNJR05FRF9TSE9SVCwgb2Zmc2V0ICogMik7IC8vKiBVaW50MTZBcnJheS5CWVRFU19QRVJfRUxFTUVOVFxuXHRcdH0gZWxzZVxuXHRcdFx0Z2wuZHJhd0FycmF5cyhwcmltaXRpdmVUeXBlLCBvZmZzZXQsIGNvdW50KTtcblx0fSxcblxuXHQvL2JpbmRzIHRoaXMgbWVzaCdzIHZlcnRleCBhdHRyaWJ1dGVzIGZvciB0aGUgZ2l2ZW4gc2hhZGVyXG5cdGJpbmQ6IGZ1bmN0aW9uKHNoYWRlcikge1xuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cblx0XHR2YXIgb2Zmc2V0ID0gMDtcblx0XHR2YXIgc3RyaWRlID0gdGhpcy5fdmVydGV4U3RyaWRlO1xuXG5cdFx0Ly9iaW5kIGFuZCB1cGRhdGUgb3VyIHZlcnRleCBkYXRhIGJlZm9yZSBiaW5kaW5nIGF0dHJpYnV0ZXNcblx0XHR0aGlzLl91cGRhdGVCdWZmZXJzKCk7XG5cblx0XHQvL2ZvciBlYWNoIGF0dHJpYnR1ZVxuXHRcdGZvciAodmFyIGk9MDsgaTx0aGlzLl92ZXJ0ZXhBdHRyaWJzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHR2YXIgYSA9IHRoaXMuX3ZlcnRleEF0dHJpYnNbaV07XG5cblx0XHRcdC8vbG9jYXRpb24gb2YgdGhlIGF0dHJpYnV0ZVxuXHRcdFx0dmFyIGxvYyA9IGEubG9jYXRpb24gPT09IG51bGwgXG5cdFx0XHRcdFx0PyBzaGFkZXIuZ2V0QXR0cmlidXRlTG9jYXRpb24oYS5uYW1lKVxuXHRcdFx0XHRcdDogYS5sb2NhdGlvbjtcblxuXHRcdFx0Ly9UT0RPOiBXZSBtYXkgd2FudCB0byBza2lwIHVuZm91bmQgYXR0cmlic1xuXHRcdFx0Ly8gaWYgKGxvYyE9PTAgJiYgIWxvYylcblx0XHRcdC8vIFx0Y29uc29sZS53YXJuKFwiV0FSTjpcIiwgYS5uYW1lLCBcImlzIG5vdCBlbmFibGVkXCIpO1xuXG5cdFx0XHQvL2ZpcnN0LCBlbmFibGUgdGhlIHZlcnRleCBhcnJheVxuXHRcdFx0Z2wuZW5hYmxlVmVydGV4QXR0cmliQXJyYXkobG9jKTtcblxuXHRcdFx0Ly90aGVuIHNwZWNpZnkgb3VyIHZlcnRleCBmb3JtYXRcblx0XHRcdGdsLnZlcnRleEF0dHJpYlBvaW50ZXIobG9jLCBhLm51bUNvbXBvbmVudHMsIGEudHlwZSB8fCBnbC5GTE9BVCwgXG5cdFx0XHRcdFx0XHRcdFx0ICAgYS5ub3JtYWxpemUsIHN0cmlkZSwgb2Zmc2V0KTtcblxuXHRcdFx0Ly9hbmQgaW5jcmVhc2UgdGhlIG9mZnNldC4uLlxuXHRcdFx0b2Zmc2V0ICs9IGEub2Zmc2V0Q291bnQgKiA0OyAvL2luIGJ5dGVzXG5cdFx0fVxuXHR9LFxuXG5cdHVuYmluZDogZnVuY3Rpb24oc2hhZGVyKSB7XG5cdFx0dmFyIGdsID0gdGhpcy5nbDtcblxuXHRcdC8vZm9yIGVhY2ggYXR0cmlidHVlXG5cdFx0Zm9yICh2YXIgaT0wOyBpPHRoaXMuX3ZlcnRleEF0dHJpYnMubGVuZ3RoOyBpKyspIHtcblx0XHRcdHZhciBhID0gdGhpcy5fdmVydGV4QXR0cmlic1tpXTtcblxuXHRcdFx0Ly9sb2NhdGlvbiBvZiB0aGUgYXR0cmlidXRlXG5cdFx0XHR2YXIgbG9jID0gYS5sb2NhdGlvbiA9PT0gbnVsbCBcblx0XHRcdFx0XHQ/IHNoYWRlci5nZXRBdHRyaWJ1dGVMb2NhdGlvbihhLm5hbWUpXG5cdFx0XHRcdFx0OiBhLmxvY2F0aW9uO1xuXG5cdFx0XHQvL2ZpcnN0LCBlbmFibGUgdGhlIHZlcnRleCBhcnJheVxuXHRcdFx0Z2wuZGlzYWJsZVZlcnRleEF0dHJpYkFycmF5KGxvYyk7XG5cdFx0fVxuXHR9XG59KTtcblxuTWVzaC5BdHRyaWIgPSBuZXcgQ2xhc3Moe1xuXG5cdG5hbWU6IG51bGwsXG5cdG51bUNvbXBvbmVudHM6IG51bGwsXG5cdGxvY2F0aW9uOiBudWxsLFxuXHR0eXBlOiBudWxsLFxuXG5cdC8qKlxuXHQgKiBMb2NhdGlvbiBpcyBvcHRpb25hbCBhbmQgZm9yIGFkdmFuY2VkIHVzZXJzIHRoYXRcblx0ICogd2FudCB2ZXJ0ZXggYXJyYXlzIHRvIG1hdGNoIGFjcm9zcyBzaGFkZXJzLiBBbnkgbm9uLW51bWVyaWNhbFxuXHQgKiB2YWx1ZSB3aWxsIGJlIGNvbnZlcnRlZCB0byBudWxsLCBhbmQgaWdub3JlZC4gSWYgYSBudW1lcmljYWxcblx0ICogdmFsdWUgaXMgZ2l2ZW4sIGl0IHdpbGwgb3ZlcnJpZGUgdGhlIHBvc2l0aW9uIG9mIHRoaXMgYXR0cmlidXRlXG5cdCAqIHdoZW4gZ2l2ZW4gdG8gYSBtZXNoLlxuXHQgKiBcblx0ICogQHBhcmFtICB7W3R5cGVdfSBuYW1lICAgICAgICAgIFtkZXNjcmlwdGlvbl1cblx0ICogQHBhcmFtICB7W3R5cGVdfSBudW1Db21wb25lbnRzIFtkZXNjcmlwdGlvbl1cblx0ICogQHBhcmFtICB7W3R5cGVdfSBsb2NhdGlvbiAgICAgIFtkZXNjcmlwdGlvbl1cblx0ICogQHJldHVybiB7W3R5cGVdfSAgICAgICAgICAgICAgIFtkZXNjcmlwdGlvbl1cblx0ICovXG5cdGluaXRpYWxpemU6IGZ1bmN0aW9uKG5hbWUsIG51bUNvbXBvbmVudHMsIGxvY2F0aW9uLCB0eXBlLCBub3JtYWxpemUsIG9mZnNldENvdW50KSB7XG5cdFx0dGhpcy5uYW1lID0gbmFtZTtcblx0XHR0aGlzLm51bUNvbXBvbmVudHMgPSBudW1Db21wb25lbnRzO1xuXHRcdHRoaXMubG9jYXRpb24gPSB0eXBlb2YgbG9jYXRpb24gPT09IFwibnVtYmVyXCIgPyBsb2NhdGlvbiA6IG51bGw7XG5cdFx0dGhpcy50eXBlID0gdHlwZTtcblx0XHR0aGlzLm5vcm1hbGl6ZSA9IEJvb2xlYW4obm9ybWFsaXplKTtcblx0XHR0aGlzLm9mZnNldENvdW50ID0gdHlwZW9mIG9mZnNldENvdW50ID09PSBcIm51bWJlclwiID8gb2Zmc2V0Q291bnQgOiB0aGlzLm51bUNvbXBvbmVudHM7XG5cdH1cbn0pXG5cblxubW9kdWxlLmV4cG9ydHMgPSBNZXNoOyIsIi8qKlxuICogQG1vZHVsZSBrYW1pXG4gKi9cblxudmFyIENsYXNzID0gcmVxdWlyZSgna2xhc3NlJyk7XG5cbnZhciBTaGFkZXJQcm9ncmFtID0gbmV3IENsYXNzKHtcblx0XG5cdGluaXRpYWxpemU6IGZ1bmN0aW9uIFNoYWRlclByb2dyYW0oY29udGV4dCwgdmVydFNvdXJjZSwgZnJhZ1NvdXJjZSwgYXR0cmlidXRlTG9jYXRpb25zKSB7XG5cdFx0aWYgKCF2ZXJ0U291cmNlIHx8ICFmcmFnU291cmNlKVxuXHRcdFx0dGhyb3cgXCJ2ZXJ0ZXggYW5kIGZyYWdtZW50IHNoYWRlcnMgbXVzdCBiZSBkZWZpbmVkXCI7XG5cdFx0aWYgKHR5cGVvZiBjb250ZXh0ICE9PSBcIm9iamVjdFwiKVxuXHRcdFx0dGhyb3cgXCJHTCBjb250ZXh0IG5vdCBzcGVjaWZpZWQgdG8gU2hhZGVyUHJvZ3JhbVwiO1xuXHRcdHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XG5cblx0XHR0aGlzLnZlcnRTaGFkZXIgPSBudWxsO1xuXHRcdHRoaXMuZnJhZ1NoYWRlciA9IG51bGw7XG5cdFx0dGhpcy5wcm9ncmFtID0gbnVsbDtcblx0XHR0aGlzLmxvZyA9IFwiXCI7XG5cblx0XHR0aGlzLnVuaWZvcm1DYWNoZSA9IG51bGw7XG5cdFx0dGhpcy5hdHRyaWJ1dGVDYWNoZSA9IG51bGw7XG5cblx0XHR0aGlzLmF0dHJpYnV0ZUxvY2F0aW9ucyA9IGF0dHJpYnV0ZUxvY2F0aW9ucztcblxuXHRcdC8vV2UgdHJpbSAoRUNNQVNjcmlwdDUpIHNvIHRoYXQgdGhlIEdMU0wgbGluZSBudW1iZXJzIGFyZVxuXHRcdC8vYWNjdXJhdGUgb24gc2hhZGVyIGxvZ1xuXHRcdHRoaXMudmVydFNvdXJjZSA9IHZlcnRTb3VyY2UudHJpbSgpO1xuXHRcdHRoaXMuZnJhZ1NvdXJjZSA9IGZyYWdTb3VyY2UudHJpbSgpO1xuXG5cdFx0Ly9BZGRzIHRoaXMgc2hhZGVyIHRvIHRoZSBjb250ZXh0LCB0byBiZSBtYW5hZ2VkXG5cdFx0dGhpcy5jb250ZXh0LmFkZE1hbmFnZWRPYmplY3QodGhpcyk7XG5cblx0XHR0aGlzLmNyZWF0ZSgpO1xuXHR9LFxuXG5cdC8qKiBcblx0ICogVGhpcyBpcyBjYWxsZWQgZHVyaW5nIHRoZSBTaGFkZXJQcm9ncmFtIGNvbnN0cnVjdG9yLFxuXHQgKiBhbmQgbWF5IG5lZWQgdG8gYmUgY2FsbGVkIGFnYWluIGFmdGVyIGNvbnRleHQgbG9zcyBhbmQgcmVzdG9yZS5cblx0ICovXG5cdGNyZWF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5nbCA9IHRoaXMuY29udGV4dC5nbDtcblx0XHR0aGlzLl9jb21waWxlU2hhZGVycygpO1xuXHR9LFxuXG5cdC8vQ29tcGlsZXMgdGhlIHNoYWRlcnMsIHRocm93aW5nIGFuIGVycm9yIGlmIHRoZSBwcm9ncmFtIHdhcyBpbnZhbGlkLlxuXHRfY29tcGlsZVNoYWRlcnM6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBnbCA9IHRoaXMuZ2w7IFxuXHRcdFxuXHRcdHRoaXMubG9nID0gXCJcIjtcblxuXHRcdHRoaXMudmVydFNoYWRlciA9IHRoaXMuX2xvYWRTaGFkZXIoZ2wuVkVSVEVYX1NIQURFUiwgdGhpcy52ZXJ0U291cmNlKTtcblx0XHR0aGlzLmZyYWdTaGFkZXIgPSB0aGlzLl9sb2FkU2hhZGVyKGdsLkZSQUdNRU5UX1NIQURFUiwgdGhpcy5mcmFnU291cmNlKTtcblxuXHRcdGlmICghdGhpcy52ZXJ0U2hhZGVyIHx8ICF0aGlzLmZyYWdTaGFkZXIpXG5cdFx0XHR0aHJvdyBcIkVycm9yIHJldHVybmVkIHdoZW4gY2FsbGluZyBjcmVhdGVTaGFkZXJcIjtcblxuXHRcdHRoaXMucHJvZ3JhbSA9IGdsLmNyZWF0ZVByb2dyYW0oKTtcblxuXHRcdGdsLmF0dGFjaFNoYWRlcih0aGlzLnByb2dyYW0sIHRoaXMudmVydFNoYWRlcik7XG5cdFx0Z2wuYXR0YWNoU2hhZGVyKHRoaXMucHJvZ3JhbSwgdGhpcy5mcmFnU2hhZGVyKTtcblx0XG5cdFx0Ly9UT0RPOiBUaGlzIHNlZW1zIG5vdCB0byBiZSB3b3JraW5nIG9uIG15IE9TWCAtLSBtYXliZSBhIGRyaXZlciBidWc/XG5cdFx0aWYgKHRoaXMuYXR0cmlidXRlTG9jYXRpb25zKSB7XG5cdFx0XHRmb3IgKHZhciBrZXkgaW4gdGhpcy5hdHRyaWJ1dGVMb2NhdGlvbnMpIHtcblx0XHRcdFx0aWYgKHRoaXMuYXR0cmlidXRlTG9jYXRpb25zLmhhc093blByb3BlcnR5KGtleSkpIHtcblx0XHRcdFx0XHRnbC5iaW5kQXR0cmliTG9jYXRpb24odGhpcy5wcm9ncmFtLCBNYXRoLmZsb29yKHRoaXMuYXR0cmlidXRlTG9jYXRpb25zW2tleV0pLCBrZXkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Z2wubGlua1Byb2dyYW0odGhpcy5wcm9ncmFtKTsgXG5cblx0XHR0aGlzLmxvZyArPSBnbC5nZXRQcm9ncmFtSW5mb0xvZyh0aGlzLnByb2dyYW0pIHx8IFwiXCI7XG5cblx0XHRpZiAoIWdsLmdldFByb2dyYW1QYXJhbWV0ZXIodGhpcy5wcm9ncmFtLCBnbC5MSU5LX1NUQVRVUykpIHtcblx0XHRcdHRocm93IFwiRXJyb3IgbGlua2luZyB0aGUgc2hhZGVyIHByb2dyYW06XFxuXCJcblx0XHRcdFx0KyB0aGlzLmxvZztcblx0XHR9XG5cblx0XHR0aGlzLl9mZXRjaFVuaWZvcm1zKCk7XG5cdFx0dGhpcy5fZmV0Y2hBdHRyaWJ1dGVzKCk7XG5cdH0sXG5cblx0X2ZldGNoVW5pZm9ybXM6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cblx0XHR0aGlzLnVuaWZvcm1DYWNoZSA9IHt9O1xuXG5cdFx0dmFyIGxlbiA9IGdsLmdldFByb2dyYW1QYXJhbWV0ZXIodGhpcy5wcm9ncmFtLCBnbC5BQ1RJVkVfVU5JRk9STVMpO1xuXHRcdGlmICghbGVuKSAvL251bGwgb3IgemVyb1xuXHRcdFx0cmV0dXJuO1xuXG5cdFx0Zm9yICh2YXIgaT0wOyBpPGxlbjsgaSsrKSB7XG5cdFx0XHR2YXIgaW5mbyA9IGdsLmdldEFjdGl2ZVVuaWZvcm0odGhpcy5wcm9ncmFtLCBpKTtcblx0XHRcdGlmIChpbmZvID09PSBudWxsKSBcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR2YXIgbmFtZSA9IGluZm8ubmFtZTtcblx0XHRcdHZhciBsb2NhdGlvbiA9IGdsLmdldFVuaWZvcm1Mb2NhdGlvbih0aGlzLnByb2dyYW0sIG5hbWUpO1xuXHRcdFx0XG5cdFx0XHR0aGlzLnVuaWZvcm1DYWNoZVtuYW1lXSA9IHtcblx0XHRcdFx0c2l6ZTogaW5mby5zaXplLFxuXHRcdFx0XHR0eXBlOiBpbmZvLnR5cGUsXG5cdFx0XHRcdGxvY2F0aW9uOiBsb2NhdGlvblxuXHRcdFx0fTtcblx0XHR9XG5cdH0sXG5cblx0X2ZldGNoQXR0cmlidXRlczogZnVuY3Rpb24oKSB7IFxuXHRcdHZhciBnbCA9IHRoaXMuZ2w7IFxuXG5cdFx0dGhpcy5hdHRyaWJ1dGVDYWNoZSA9IHt9O1xuXG5cdFx0dmFyIGxlbiA9IGdsLmdldFByb2dyYW1QYXJhbWV0ZXIodGhpcy5wcm9ncmFtLCBnbC5BQ1RJVkVfQVRUUklCVVRFUyk7XG5cdFx0aWYgKCFsZW4pIC8vbnVsbCBvciB6ZXJvXG5cdFx0XHRyZXR1cm47XHRcblxuXHRcdGZvciAodmFyIGk9MDsgaTxsZW47IGkrKykge1xuXHRcdFx0dmFyIGluZm8gPSBnbC5nZXRBY3RpdmVBdHRyaWIodGhpcy5wcm9ncmFtLCBpKTtcblx0XHRcdGlmIChpbmZvID09PSBudWxsKSBcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR2YXIgbmFtZSA9IGluZm8ubmFtZTtcblxuXHRcdFx0Ly90aGUgYXR0cmliIGxvY2F0aW9uIGlzIGEgc2ltcGxlIGluZGV4XG5cdFx0XHR2YXIgbG9jYXRpb24gPSBnbC5nZXRBdHRyaWJMb2NhdGlvbih0aGlzLnByb2dyYW0sIG5hbWUpO1xuXHRcdFx0XG5cdFx0XHR0aGlzLmF0dHJpYnV0ZUNhY2hlW25hbWVdID0ge1xuXHRcdFx0XHRzaXplOiBpbmZvLnNpemUsXG5cdFx0XHRcdHR5cGU6IGluZm8udHlwZSxcblx0XHRcdFx0bG9jYXRpb246IGxvY2F0aW9uXG5cdFx0XHR9O1xuXHRcdH1cblx0fSxcblxuXHRfbG9hZFNoYWRlcjogZnVuY3Rpb24odHlwZSwgc291cmNlKSB7XG5cdFx0dmFyIGdsID0gdGhpcy5nbDtcblxuXHRcdHZhciBzaGFkZXIgPSBnbC5jcmVhdGVTaGFkZXIodHlwZSk7XG5cdFx0aWYgKCFzaGFkZXIpIC8vc2hvdWxkIG5vdCBvY2N1ci4uLlxuXHRcdFx0cmV0dXJuIC0xO1xuXG5cdFx0Z2wuc2hhZGVyU291cmNlKHNoYWRlciwgc291cmNlKTtcblx0XHRnbC5jb21waWxlU2hhZGVyKHNoYWRlcik7XG5cdFx0XG5cdFx0dmFyIGxvZ1Jlc3VsdCA9IGdsLmdldFNoYWRlckluZm9Mb2coc2hhZGVyKSB8fCBcIlwiO1xuXHRcdGlmIChsb2dSZXN1bHQpIHtcblx0XHRcdC8vd2UgZG8gdGhpcyBzbyB0aGUgdXNlciBrbm93cyB3aGljaCBzaGFkZXIgaGFzIHRoZSBlcnJvclxuXHRcdFx0dmFyIHR5cGVTdHIgPSAodHlwZSA9PT0gZ2wuVkVSVEVYX1NIQURFUikgPyBcInZlcnRleFwiIDogXCJmcmFnbWVudFwiO1xuXHRcdFx0bG9nUmVzdWx0ID0gXCJFcnJvciBjb21waWxpbmcgXCIrIHR5cGVTdHIrIFwiIHNoYWRlcjpcXG5cIitsb2dSZXN1bHQ7XG5cdFx0fVxuXG5cdFx0dGhpcy5sb2cgKz0gbG9nUmVzdWx0O1xuXG5cdFx0aWYgKCFnbC5nZXRTaGFkZXJQYXJhbWV0ZXIoc2hhZGVyLCBnbC5DT01QSUxFX1NUQVRVUykgKSB7XG5cdFx0XHR0aHJvdyB0aGlzLmxvZztcblx0XHR9XG5cdFx0cmV0dXJuIHNoYWRlcjtcblx0fSxcblxuXG5cdGJpbmQ6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMuZ2wudXNlUHJvZ3JhbSh0aGlzLnByb2dyYW0pO1xuXHR9LFxuXG5cdGRlc3Ryb3k6IGZ1bmN0aW9uKCkge1xuXHRcdGlmICh0aGlzLmNvbnRleHQpXG5cdFx0XHR0aGlzLmNvbnRleHQucmVtb3ZlTWFuYWdlZE9iamVjdCh0aGlzKTtcblxuXHRcdGlmICh0aGlzLmdsKSB7XG5cdFx0XHR2YXIgZ2wgPSB0aGlzLmdsO1xuXHRcdFx0Z2wuZGV0YWNoU2hhZGVyKHRoaXMudmVydFNoYWRlcik7XG5cdFx0XHRnbC5kZXRhY2hTaGFkZXIodGhpcy5mcmFnU2hhZGVyKTtcblxuXHRcdFx0Z2wuZGVsZXRlU2hhZGVyKHRoaXMudmVydFNoYWRlcik7XG5cdFx0XHRnbC5kZWxldGVTaGFkZXIodGhpcy5mcmFnU2hhZGVyKTtcblx0XHRcdGdsLmRlbGV0ZVByb2dyYW0odGhpcy5wcm9ncmFtKTtcblx0XHR9XG5cdFx0dGhpcy5hdHRyaWJ1dGVDYWNoZSA9IG51bGw7XG5cdFx0dGhpcy51bmlmb3JtQ2FjaGUgPSBudWxsO1xuXHRcdHRoaXMudmVydFNoYWRlciA9IG51bGw7XG5cdFx0dGhpcy5mcmFnU2hhZGVyID0gbnVsbDtcblx0XHR0aGlzLnByb2dyYW0gPSBudWxsO1xuXHRcdHRoaXMuZ2wgPSBudWxsO1xuXHRcdHRoaXMuY29udGV4dCA9IG51bGw7XG5cdH0sXG5cblxuXHQvKipcblx0ICogUmV0dXJucyB0aGUgY2FjaGVkIHVuaWZvcm0gaW5mbyAoc2l6ZSwgdHlwZSwgbG9jYXRpb24pLlxuXHQgKiBJZiB0aGUgdW5pZm9ybSBpcyBub3QgZm91bmQgaW4gdGhlIGNhY2hlLCBpdCBpcyBhc3N1bWVkXG5cdCAqIHRvIG5vdCBleGlzdCwgYW5kIHRoaXMgbWV0aG9kIHJldHVybnMgbnVsbC5cblx0ICpcblx0ICogVGhpcyBtYXkgcmV0dXJuIG51bGwgZXZlbiBpZiB0aGUgdW5pZm9ybSBpcyBkZWZpbmVkIGluIEdMU0w6XG5cdCAqIGlmIGl0IGlzIF9pbmFjdGl2ZV8gKGkuZS4gbm90IHVzZWQgaW4gdGhlIHByb2dyYW0pIHRoZW4gaXQgbWF5XG5cdCAqIGJlIG9wdGltaXplZCBvdXQuXG5cdCAqXG5cdCAqIEBtZXRob2QgIGdldFVuaWZvcm1JbmZvXG5cdCAqIEBwYXJhbSAge1N0cmluZ30gbmFtZSB0aGUgdW5pZm9ybSBuYW1lIGFzIGRlZmluZWQgaW4gR0xTTFxuXHQgKiBAcmV0dXJuIHtPYmplY3R9IGFuIG9iamVjdCBjb250YWluaW5nIGxvY2F0aW9uLCBzaXplLCBhbmQgdHlwZVxuXHQgKi9cblx0Z2V0VW5pZm9ybUluZm86IGZ1bmN0aW9uKG5hbWUpIHtcblx0XHRyZXR1cm4gdGhpcy51bmlmb3JtQ2FjaGVbbmFtZV0gfHwgbnVsbDsgXG5cdH0sXG5cblx0LyoqXG5cdCAqIFJldHVybnMgdGhlIGNhY2hlZCBhdHRyaWJ1dGUgaW5mbyAoc2l6ZSwgdHlwZSwgbG9jYXRpb24pLlxuXHQgKiBJZiB0aGUgYXR0cmlidXRlIGlzIG5vdCBmb3VuZCBpbiB0aGUgY2FjaGUsIGl0IGlzIGFzc3VtZWRcblx0ICogdG8gbm90IGV4aXN0LCBhbmQgdGhpcyBtZXRob2QgcmV0dXJucyBudWxsLlxuXHQgKlxuXHQgKiBUaGlzIG1heSByZXR1cm4gbnVsbCBldmVuIGlmIHRoZSBhdHRyaWJ1dGUgaXMgZGVmaW5lZCBpbiBHTFNMOlxuXHQgKiBpZiBpdCBpcyBfaW5hY3RpdmVfIChpLmUuIG5vdCB1c2VkIGluIHRoZSBwcm9ncmFtIG9yIGRpc2FibGVkKSBcblx0ICogdGhlbiBpdCBtYXkgYmUgb3B0aW1pemVkIG91dC5cblx0ICpcblx0ICogQG1ldGhvZCAgZ2V0QXR0cmlidXRlSW5mb1xuXHQgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWUgdGhlIGF0dHJpYnV0ZSBuYW1lIGFzIGRlZmluZWQgaW4gR0xTTFxuXHQgKiBAcmV0dXJuIHtvYmplY3R9IGFuIG9iamVjdCBjb250YWluaW5nIGxvY2F0aW9uLCBzaXplIGFuZCB0eXBlXG5cdCAqL1xuXHRnZXRBdHRyaWJ1dGVJbmZvOiBmdW5jdGlvbihuYW1lKSB7XG5cdFx0cmV0dXJuIHRoaXMuYXR0cmlidXRlQ2FjaGVbbmFtZV0gfHwgbnVsbDsgXG5cdH0sXG5cblxuXHQvKipcblx0ICogUmV0dXJucyB0aGUgY2FjaGVkIHVuaWZvcm0gbG9jYXRpb24gb2JqZWN0LlxuXHQgKiBJZiB0aGUgdW5pZm9ybSBpcyBub3QgZm91bmQsIHRoaXMgbWV0aG9kIHJldHVybnMgbnVsbC5cblx0ICpcblx0ICogQG1ldGhvZCAgZ2V0QXR0cmlidXRlTG9jYXRpb25cblx0ICogQHBhcmFtICB7U3RyaW5nfSBuYW1lIHRoZSB1bmlmb3JtIG5hbWUgYXMgZGVmaW5lZCBpbiBHTFNMXG5cdCAqIEByZXR1cm4ge0dMaW50fSB0aGUgbG9jYXRpb24gb2JqZWN0XG5cdCAqL1xuXHRnZXRBdHRyaWJ1dGVMb2NhdGlvbjogZnVuY3Rpb24obmFtZSkgeyAvL1RPRE86IG1ha2UgZmFzdGVyLCBkb24ndCBjYWNoZVxuXHRcdHZhciBpbmZvID0gdGhpcy5nZXRBdHRyaWJ1dGVJbmZvKG5hbWUpO1xuXHRcdHJldHVybiBpbmZvID8gaW5mby5sb2NhdGlvbiA6IG51bGw7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFJldHVybnMgdGhlIGNhY2hlZCB1bmlmb3JtIGxvY2F0aW9uIG9iamVjdCwgYXNzdW1pbmcgaXQgZXhpc3RzXG5cdCAqIGFuZCBpcyBhY3RpdmUuIE5vdGUgdGhhdCB1bmlmb3JtcyBtYXkgYmUgaW5hY3RpdmUgaWYgXG5cdCAqIHRoZSBHTFNMIGNvbXBpbGVyIGRlZW1lZCB0aGVtIHVudXNlZC5cblx0ICpcblx0ICogQG1ldGhvZCAgZ2V0VW5pZm9ybUxvY2F0aW9uXG5cdCAqIEBwYXJhbSAge1N0cmluZ30gbmFtZSB0aGUgdW5pZm9ybSBuYW1lIGFzIGRlZmluZWQgaW4gR0xTTFxuXHQgKiBAcmV0dXJuIHtXZWJHTFVuaWZvcm1Mb2NhdGlvbn0gdGhlIGxvY2F0aW9uIG9iamVjdFxuXHQgKi9cblx0Z2V0VW5pZm9ybUxvY2F0aW9uOiBmdW5jdGlvbihuYW1lKSB7XG5cdFx0dmFyIGluZm8gPSB0aGlzLmdldFVuaWZvcm1JbmZvKG5hbWUpO1xuXHRcdHJldHVybiBpbmZvID8gaW5mby5sb2NhdGlvbiA6IG51bGw7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgdW5pZm9ybSBpcyBhY3RpdmUgYW5kIGZvdW5kIGluIHRoaXNcblx0ICogY29tcGlsZWQgcHJvZ3JhbS4gTm90ZSB0aGF0IHVuaWZvcm1zIG1heSBiZSBpbmFjdGl2ZSBpZiBcblx0ICogdGhlIEdMU0wgY29tcGlsZXIgZGVlbWVkIHRoZW0gdW51c2VkLlxuXHQgKlxuXHQgKiBAbWV0aG9kICBoYXNVbmlmb3JtXG5cdCAqIEBwYXJhbSAge1N0cmluZ30gIG5hbWUgdGhlIHVuaWZvcm0gbmFtZVxuXHQgKiBAcmV0dXJuIHtCb29sZWFufSB0cnVlIGlmIHRoZSB1bmlmb3JtIGlzIGZvdW5kIGFuZCBhY3RpdmVcblx0ICovXG5cdGhhc1VuaWZvcm06IGZ1bmN0aW9uKG5hbWUpIHtcblx0XHRyZXR1cm4gdGhpcy5nZXRVbmlmb3JtSW5mbyhuYW1lKSAhPT0gbnVsbDtcblx0fSxcblxuXHQvKipcblx0ICogUmV0dXJucyB0cnVlIGlmIHRoZSBhdHRyaWJ1dGUgaXMgYWN0aXZlIGFuZCBmb3VuZCBpbiB0aGlzXG5cdCAqIGNvbXBpbGVkIHByb2dyYW0uXG5cdCAqXG5cdCAqIEBtZXRob2QgIGhhc0F0dHJpYnV0ZVxuXHQgKiBAcGFyYW0gIHtTdHJpbmd9ICBuYW1lIHRoZSBhdHRyaWJ1dGUgbmFtZVxuXHQgKiBAcmV0dXJuIHtCb29sZWFufSB0cnVlIGlmIHRoZSBhdHRyaWJ1dGUgaXMgZm91bmQgYW5kIGFjdGl2ZVxuXHQgKi9cblx0aGFzQXR0cmlidXRlOiBmdW5jdGlvbihuYW1lKSB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0QXR0cmlidXRlSW5mbyhuYW1lKSAhPT0gbnVsbDtcblx0fSxcblxuXHQvKipcblx0ICogUmV0dXJucyB0aGUgdW5pZm9ybSB2YWx1ZSBieSBuYW1lLlxuXHQgKlxuXHQgKiBAbWV0aG9kICBnZXRVbmlmb3JtXG5cdCAqIEBwYXJhbSAge1N0cmluZ30gbmFtZSB0aGUgdW5pZm9ybSBuYW1lIGFzIGRlZmluZWQgaW4gR0xTTFxuXHQgKiBAcmV0dXJuIHthbnl9IFRoZSB2YWx1ZSBvZiB0aGUgV2ViR0wgdW5pZm9ybVxuXHQgKi9cblx0Z2V0VW5pZm9ybTogZnVuY3Rpb24obmFtZSkge1xuXHRcdHJldHVybiB0aGlzLmdsLmdldFVuaWZvcm0odGhpcy5wcm9ncmFtLCB0aGlzLmdldFVuaWZvcm1Mb2NhdGlvbihuYW1lKSk7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFJldHVybnMgdGhlIHVuaWZvcm0gdmFsdWUgYXQgdGhlIHNwZWNpZmllZCBXZWJHTFVuaWZvcm1Mb2NhdGlvbi5cblx0ICpcblx0ICogQG1ldGhvZCAgZ2V0VW5pZm9ybUF0XG5cdCAqIEBwYXJhbSAge1dlYkdMVW5pZm9ybUxvY2F0aW9ufSBsb2NhdGlvbiB0aGUgbG9jYXRpb24gb2JqZWN0XG5cdCAqIEByZXR1cm4ge2FueX0gVGhlIHZhbHVlIG9mIHRoZSBXZWJHTCB1bmlmb3JtXG5cdCAqL1xuXHRnZXRVbmlmb3JtQXQ6IGZ1bmN0aW9uKGxvY2F0aW9uKSB7XG5cdFx0cmV0dXJuIHRoaXMuZ2wuZ2V0VW5pZm9ybSh0aGlzLnByb2dyYW0sIGxvY2F0aW9uKTtcblx0fSxcblxuXHQvKipcblx0ICogQSBjb252ZW5pZW5jZSBtZXRob2QgdG8gc2V0IHVuaWZvcm1pIGZyb20gdGhlIGdpdmVuIGFyZ3VtZW50cy5cblx0ICogV2UgZGV0ZXJtaW5lIHdoaWNoIEdMIGNhbGwgdG8gbWFrZSBiYXNlZCBvbiB0aGUgbnVtYmVyIG9mIGFyZ3VtZW50c1xuXHQgKiBwYXNzZWQuIEZvciBleGFtcGxlLCBgc2V0VW5pZm9ybWkoXCJ2YXJcIiwgMCwgMSlgIG1hcHMgdG8gYGdsLnVuaWZvcm0yaWAuXG5cdCAqIFxuXHQgKiBAbWV0aG9kICBzZXRVbmlmb3JtaVxuXHQgKiBAcGFyYW0ge1N0cmluZ30gbmFtZSAgICAgICAgXHRcdHRoZSBuYW1lIG9mIHRoZSB1bmlmb3JtXG5cdCAqIEBwYXJhbSB7R0xpbnR9IHggIHRoZSB4IGNvbXBvbmVudCBmb3IgaW50c1xuXHQgKiBAcGFyYW0ge0dMaW50fSB5ICB0aGUgeSBjb21wb25lbnQgZm9yIGl2ZWMyXG5cdCAqIEBwYXJhbSB7R0xpbnR9IHogIHRoZSB6IGNvbXBvbmVudCBmb3IgaXZlYzNcblx0ICogQHBhcmFtIHtHTGludH0gdyAgdGhlIHcgY29tcG9uZW50IGZvciBpdmVjNFxuXHQgKi9cblx0c2V0VW5pZm9ybWk6IGZ1bmN0aW9uKG5hbWUsIHgsIHksIHosIHcpIHtcblx0XHR2YXIgZ2wgPSB0aGlzLmdsO1xuXHRcdHZhciBsb2MgPSB0aGlzLmdldFVuaWZvcm1Mb2NhdGlvbihuYW1lKTtcblx0XHRpZiAoIWxvYykgXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0c3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG5cdFx0XHRjYXNlIDI6IGdsLnVuaWZvcm0xaShsb2MsIHgpOyByZXR1cm4gdHJ1ZTtcblx0XHRcdGNhc2UgMzogZ2wudW5pZm9ybTJpKGxvYywgeCwgeSk7IHJldHVybiB0cnVlO1xuXHRcdFx0Y2FzZSA0OiBnbC51bmlmb3JtM2kobG9jLCB4LCB5LCB6KTsgcmV0dXJuIHRydWU7XG5cdFx0XHRjYXNlIDU6IGdsLnVuaWZvcm00aShsb2MsIHgsIHksIHosIHcpOyByZXR1cm4gdHJ1ZTtcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHRocm93IFwiaW52YWxpZCBhcmd1bWVudHMgdG8gc2V0VW5pZm9ybWlcIjsgXG5cdFx0fVxuXHR9LFxuXG5cdC8qKlxuXHQgKiBBIGNvbnZlbmllbmNlIG1ldGhvZCB0byBzZXQgdW5pZm9ybWYgZnJvbSB0aGUgZ2l2ZW4gYXJndW1lbnRzLlxuXHQgKiBXZSBkZXRlcm1pbmUgd2hpY2ggR0wgY2FsbCB0byBtYWtlIGJhc2VkIG9uIHRoZSBudW1iZXIgb2YgYXJndW1lbnRzXG5cdCAqIHBhc3NlZC4gRm9yIGV4YW1wbGUsIGBzZXRVbmlmb3JtZihcInZhclwiLCAwLCAxKWAgbWFwcyB0byBgZ2wudW5pZm9ybTJmYC5cblx0ICogXG5cdCAqIEBtZXRob2QgIHNldFVuaWZvcm1mXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lICAgICAgICBcdFx0dGhlIG5hbWUgb2YgdGhlIHVuaWZvcm1cblx0ICogQHBhcmFtIHtHTGZsb2F0fSB4ICB0aGUgeCBjb21wb25lbnQgZm9yIGZsb2F0c1xuXHQgKiBAcGFyYW0ge0dMZmxvYXR9IHkgIHRoZSB5IGNvbXBvbmVudCBmb3IgdmVjMlxuXHQgKiBAcGFyYW0ge0dMZmxvYXR9IHogIHRoZSB6IGNvbXBvbmVudCBmb3IgdmVjM1xuXHQgKiBAcGFyYW0ge0dMZmxvYXR9IHcgIHRoZSB3IGNvbXBvbmVudCBmb3IgdmVjNFxuXHQgKi9cblx0c2V0VW5pZm9ybWY6IGZ1bmN0aW9uKG5hbWUsIHgsIHksIHosIHcpIHtcblx0XHR2YXIgZ2wgPSB0aGlzLmdsO1xuXHRcdHZhciBsb2MgPSB0aGlzLmdldFVuaWZvcm1Mb2NhdGlvbihuYW1lKTtcblx0XHRpZiAoIWxvYykgXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0c3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG5cdFx0XHRjYXNlIDI6IGdsLnVuaWZvcm0xZihsb2MsIHgpOyByZXR1cm4gdHJ1ZTtcblx0XHRcdGNhc2UgMzogZ2wudW5pZm9ybTJmKGxvYywgeCwgeSk7IHJldHVybiB0cnVlO1xuXHRcdFx0Y2FzZSA0OiBnbC51bmlmb3JtM2YobG9jLCB4LCB5LCB6KTsgcmV0dXJuIHRydWU7XG5cdFx0XHRjYXNlIDU6IGdsLnVuaWZvcm00Zihsb2MsIHgsIHksIHosIHcpOyByZXR1cm4gdHJ1ZTtcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHRocm93IFwiaW52YWxpZCBhcmd1bWVudHMgdG8gc2V0VW5pZm9ybWZcIjsgXG5cdFx0fVxuXHR9LFxuXG5cdC8vSSBndWVzcyB3ZSB3b24ndCBzdXBwb3J0IHNlcXVlbmNlPEdMZmxvYXQ+IC4uIHdoYXRldmVyIHRoYXQgaXMgPz9cblx0XG5cblx0Ly8vLy8gXG5cdFxuXHQvKipcblx0ICogQSBjb252ZW5pZW5jZSBtZXRob2QgdG8gc2V0IHVuaWZvcm1OZnYgZnJvbSB0aGUgZ2l2ZW4gQXJyYXlCdWZmZXIuXG5cdCAqIFdlIGRldGVybWluZSB3aGljaCBHTCBjYWxsIHRvIG1ha2UgYmFzZWQgb24gdGhlIGxlbmd0aCBvZiB0aGUgYXJyYXkgXG5cdCAqIGJ1ZmZlciAoZm9yIDEtNCBjb21wb25lbnQgdmVjdG9ycyBzdG9yZWQgaW4gYSBGbG9hdDMyQXJyYXkpLiBUbyB1c2Vcblx0ICogdGhpcyBtZXRob2QgdG8gdXBsb2FkIGRhdGEgdG8gdW5pZm9ybSBhcnJheXMsIHlvdSBuZWVkIHRvIHNwZWNpZnkgdGhlXG5cdCAqICdjb3VudCcgcGFyYW1ldGVyOyBpLmUuIHRoZSBkYXRhIHR5cGUgeW91IGFyZSB1c2luZyBmb3IgdGhhdCBhcnJheS4gSWZcblx0ICogc3BlY2lmaWVkLCB0aGlzIHdpbGwgZGljdGF0ZSB3aGV0aGVyIHRvIGNhbGwgdW5pZm9ybTFmdiwgdW5pZm9ybTJmdiwgZXRjLlxuXHQgKlxuXHQgKiBAbWV0aG9kICBzZXRVbmlmb3JtZnZcblx0ICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgICAgICAgIFx0XHR0aGUgbmFtZSBvZiB0aGUgdW5pZm9ybVxuXHQgKiBAcGFyYW0ge0FycmF5QnVmZmVyfSBhcnJheUJ1ZmZlciB0aGUgYXJyYXkgYnVmZmVyXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBjb3VudCAgICAgICAgICAgIG9wdGlvbmFsLCB0aGUgZXhwbGljaXQgZGF0YSB0eXBlIGNvdW50LCBlLmcuIDIgZm9yIHZlYzJcblx0ICovXG5cdHNldFVuaWZvcm1mdjogZnVuY3Rpb24obmFtZSwgYXJyYXlCdWZmZXIsIGNvdW50KSB7XG5cdFx0Y291bnQgPSBjb3VudCB8fCBhcnJheUJ1ZmZlci5sZW5ndGg7XG5cdFx0dmFyIGdsID0gdGhpcy5nbDtcblx0XHR2YXIgbG9jID0gdGhpcy5nZXRVbmlmb3JtTG9jYXRpb24obmFtZSk7XG5cdFx0aWYgKCFsb2MpIFxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdHN3aXRjaCAoY291bnQpIHtcblx0XHRcdGNhc2UgMTogZ2wudW5pZm9ybTFmdihsb2MsIGFycmF5QnVmZmVyKTsgcmV0dXJuIHRydWU7XG5cdFx0XHRjYXNlIDI6IGdsLnVuaWZvcm0yZnYobG9jLCBhcnJheUJ1ZmZlcik7IHJldHVybiB0cnVlO1xuXHRcdFx0Y2FzZSAzOiBnbC51bmlmb3JtM2Z2KGxvYywgYXJyYXlCdWZmZXIpOyByZXR1cm4gdHJ1ZTtcblx0XHRcdGNhc2UgNDogZ2wudW5pZm9ybTRmdihsb2MsIGFycmF5QnVmZmVyKTsgcmV0dXJuIHRydWU7XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHR0aHJvdyBcImludmFsaWQgYXJndW1lbnRzIHRvIHNldFVuaWZvcm1mXCI7IFxuXHRcdH1cblx0fSxcblxuXHQvKipcblx0ICogQSBjb252ZW5pZW5jZSBtZXRob2QgdG8gc2V0IHVuaWZvcm1OaXYgZnJvbSB0aGUgZ2l2ZW4gQXJyYXlCdWZmZXIuXG5cdCAqIFdlIGRldGVybWluZSB3aGljaCBHTCBjYWxsIHRvIG1ha2UgYmFzZWQgb24gdGhlIGxlbmd0aCBvZiB0aGUgYXJyYXkgXG5cdCAqIGJ1ZmZlciAoZm9yIDEtNCBjb21wb25lbnQgdmVjdG9ycyBzdG9yZWQgaW4gYSBpbnQgYXJyYXkpLiBUbyB1c2Vcblx0ICogdGhpcyBtZXRob2QgdG8gdXBsb2FkIGRhdGEgdG8gdW5pZm9ybSBhcnJheXMsIHlvdSBuZWVkIHRvIHNwZWNpZnkgdGhlXG5cdCAqICdjb3VudCcgcGFyYW1ldGVyOyBpLmUuIHRoZSBkYXRhIHR5cGUgeW91IGFyZSB1c2luZyBmb3IgdGhhdCBhcnJheS4gSWZcblx0ICogc3BlY2lmaWVkLCB0aGlzIHdpbGwgZGljdGF0ZSB3aGV0aGVyIHRvIGNhbGwgdW5pZm9ybTFmdiwgdW5pZm9ybTJmdiwgZXRjLlxuXHQgKlxuXHQgKiBAbWV0aG9kICBzZXRVbmlmb3JtaXZcblx0ICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgICAgICAgIFx0XHR0aGUgbmFtZSBvZiB0aGUgdW5pZm9ybVxuXHQgKiBAcGFyYW0ge0FycmF5QnVmZmVyfSBhcnJheUJ1ZmZlciB0aGUgYXJyYXkgYnVmZmVyXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBjb3VudCAgICAgICAgICAgIG9wdGlvbmFsLCB0aGUgZXhwbGljaXQgZGF0YSB0eXBlIGNvdW50LCBlLmcuIDIgZm9yIGl2ZWMyXG5cdCAqL1xuXHRzZXRVbmlmb3JtaXY6IGZ1bmN0aW9uKG5hbWUsIGFycmF5QnVmZmVyLCBjb3VudCkge1xuXHRcdGNvdW50ID0gY291bnQgfHwgYXJyYXlCdWZmZXIubGVuZ3RoO1xuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cdFx0dmFyIGxvYyA9IHRoaXMuZ2V0VW5pZm9ybUxvY2F0aW9uKG5hbWUpO1xuXHRcdGlmICghbG9jKSBcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRzd2l0Y2ggKGNvdW50KSB7XG5cdFx0XHRjYXNlIDE6IGdsLnVuaWZvcm0xaXYobG9jLCBhcnJheUJ1ZmZlcik7IHJldHVybiB0cnVlO1xuXHRcdFx0Y2FzZSAyOiBnbC51bmlmb3JtMml2KGxvYywgYXJyYXlCdWZmZXIpOyByZXR1cm4gdHJ1ZTtcblx0XHRcdGNhc2UgMzogZ2wudW5pZm9ybTNpdihsb2MsIGFycmF5QnVmZmVyKTsgcmV0dXJuIHRydWU7XG5cdFx0XHRjYXNlIDQ6IGdsLnVuaWZvcm00aXYobG9jLCBhcnJheUJ1ZmZlcik7IHJldHVybiB0cnVlO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0dGhyb3cgXCJpbnZhbGlkIGFyZ3VtZW50cyB0byBzZXRVbmlmb3JtZlwiOyBcblx0XHR9XG5cdH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFNoYWRlclByb2dyYW07IiwiLyoqXG4gIEF1dG8tZ2VuZXJhdGVkIEthbWkgaW5kZXggZmlsZS5cbiAgQ3JlYXRlZCBvbiAyMDEzLTEyLTIwLlxuKi9cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIC8vY29yZSBjbGFzc2VzXG4gICAgJ0Jhc2VCYXRjaCc6ICAgICAgIHJlcXVpcmUoJy4vQmFzZUJhdGNoLmpzJyksXG4gICAgJ1Nwcml0ZUJhdGNoJzogICAgIHJlcXVpcmUoJy4vU3ByaXRlQmF0Y2guanMnKSxcbiAgICAnVGV4dHVyZSc6ICAgICAgICAgcmVxdWlyZSgnLi9UZXh0dXJlLmpzJyksXG4gICAgJ1RleHR1cmVSZWdpb24nOiAgIHJlcXVpcmUoJy4vVGV4dHVyZVJlZ2lvbi5qcycpLFxuICAgICdXZWJHTENvbnRleHQnOiAgICByZXF1aXJlKCcuL1dlYkdMQ29udGV4dC5qcycpLFxuICAgICdGcmFtZUJ1ZmZlcic6ICAgICByZXF1aXJlKCcuL2dsdXRpbHMvRnJhbWVCdWZmZXIuanMnKSxcbiAgICAnTWVzaCc6ICAgICAgICAgICAgcmVxdWlyZSgnLi9nbHV0aWxzL01lc2guanMnKSxcbiAgICAnU2hhZGVyUHJvZ3JhbSc6ICAgcmVxdWlyZSgnLi9nbHV0aWxzL1NoYWRlclByb2dyYW0uanMnKVxufTsiLCJ2YXIgaW50OCA9IG5ldyBJbnQ4QXJyYXkoNCk7XG52YXIgaW50MzIgPSBuZXcgSW50MzJBcnJheShpbnQ4LmJ1ZmZlciwgMCwgMSk7XG52YXIgZmxvYXQzMiA9IG5ldyBGbG9hdDMyQXJyYXkoaW50OC5idWZmZXIsIDAsIDEpO1xuXG4vKipcbiAqIEEgc2luZ2xldG9uIGZvciBudW1iZXIgdXRpbGl0aWVzLiBcbiAqIEBjbGFzcyBOdW1iZXJVdGlsXG4gKi9cbnZhciBOdW1iZXJVdGlsID0gZnVuY3Rpb24oKSB7XG5cbn07XG5cblxuLyoqXG4gKiBSZXR1cm5zIGEgZmxvYXQgcmVwcmVzZW50YXRpb24gb2YgdGhlIGdpdmVuIGludCBiaXRzLiBBcnJheUJ1ZmZlclxuICogaXMgdXNlZCBmb3IgdGhlIGNvbnZlcnNpb24uXG4gKlxuICogQG1ldGhvZCAgaW50Qml0c1RvRmxvYXRcbiAqIEBzdGF0aWNcbiAqIEBwYXJhbSAge051bWJlcn0gaSB0aGUgaW50IHRvIGNhc3RcbiAqIEByZXR1cm4ge051bWJlcn0gICB0aGUgZmxvYXRcbiAqL1xuTnVtYmVyVXRpbC5pbnRCaXRzVG9GbG9hdCA9IGZ1bmN0aW9uKGkpIHtcblx0aW50MzJbMF0gPSBpO1xuXHRyZXR1cm4gZmxvYXQzMlswXTtcbn07XG5cbi8qKlxuICogUmV0dXJucyB0aGUgaW50IGJpdHMgZnJvbSB0aGUgZ2l2ZW4gZmxvYXQuIEFycmF5QnVmZmVyIGlzIHVzZWRcbiAqIGZvciB0aGUgY29udmVyc2lvbi5cbiAqXG4gKiBAbWV0aG9kICBmbG9hdFRvSW50Qml0c1xuICogQHN0YXRpY1xuICogQHBhcmFtICB7TnVtYmVyfSBmIHRoZSBmbG9hdCB0byBjYXN0XG4gKiBAcmV0dXJuIHtOdW1iZXJ9ICAgdGhlIGludCBiaXRzXG4gKi9cbk51bWJlclV0aWwuZmxvYXRUb0ludEJpdHMgPSBmdW5jdGlvbihmKSB7XG5cdGZsb2F0MzJbMF0gPSBmO1xuXHRyZXR1cm4gaW50MzJbMF07XG59O1xuXG4vKipcbiAqIEVuY29kZXMgQUJHUiBpbnQgYXMgYSBmbG9hdCwgd2l0aCBzbGlnaHQgcHJlY2lzaW9uIGxvc3MuXG4gKlxuICogQG1ldGhvZCAgaW50VG9GbG9hdENvbG9yXG4gKiBAc3RhdGljXG4gKiBAcGFyYW0ge051bWJlcn0gdmFsdWUgYW4gQUJHUiBwYWNrZWQgaW50ZWdlclxuICovXG5OdW1iZXJVdGlsLmludFRvRmxvYXRDb2xvciA9IGZ1bmN0aW9uKHZhbHVlKSB7XG5cdHJldHVybiBOdW1iZXJVdGlsLmludEJpdHNUb0Zsb2F0KCB2YWx1ZSAmIDB4ZmVmZmZmZmYgKTtcbn07XG5cbi8qKlxuICogUmV0dXJucyBhIGZsb2F0IGVuY29kZWQgQUJHUiB2YWx1ZSBmcm9tIHRoZSBnaXZlbiBSR0JBXG4gKiBieXRlcyAoMCAtIDI1NSkuIFVzZWZ1bCBmb3Igc2F2aW5nIGJhbmR3aWR0aCBpbiB2ZXJ0ZXggZGF0YS5cbiAqXG4gKiBAbWV0aG9kICBjb2xvclRvRmxvYXRcbiAqIEBzdGF0aWNcbiAqIEBwYXJhbSB7TnVtYmVyfSByIHRoZSBSZWQgYnl0ZSAoMCAtIDI1NSlcbiAqIEBwYXJhbSB7TnVtYmVyfSBnIHRoZSBHcmVlbiBieXRlICgwIC0gMjU1KVxuICogQHBhcmFtIHtOdW1iZXJ9IGIgdGhlIEJsdWUgYnl0ZSAoMCAtIDI1NSlcbiAqIEBwYXJhbSB7TnVtYmVyfSBhIHRoZSBBbHBoYSBieXRlICgwIC0gMjU1KVxuICogQHJldHVybiB7RmxvYXQzMn0gIGEgRmxvYXQzMiBvZiB0aGUgUkdCQSBjb2xvclxuICovXG5OdW1iZXJVdGlsLmNvbG9yVG9GbG9hdCA9IGZ1bmN0aW9uKHIsIGcsIGIsIGEpIHtcblx0dmFyIGJpdHMgPSAoYSA8PCAyNCB8IGIgPDwgMTYgfCBnIDw8IDggfCByKTtcblx0cmV0dXJuIE51bWJlclV0aWwuaW50VG9GbG9hdENvbG9yKGJpdHMpO1xufTtcblxuLyoqXG4gKiBSZXR1cm5zIHRydWUgaWYgdGhlIG51bWJlciBpcyBhIHBvd2VyLW9mLXR3by5cbiAqXG4gKiBAbWV0aG9kICBpc1Bvd2VyT2ZUd29cbiAqIEBwYXJhbSAge051bWJlcn0gIG4gdGhlIG51bWJlciB0byB0ZXN0XG4gKiBAcmV0dXJuIHtCb29sZWFufSAgIHRydWUgaWYgcG93ZXItb2YtdHdvXG4gKi9cbk51bWJlclV0aWwuaXNQb3dlck9mVHdvID0gZnVuY3Rpb24obikge1xuXHRyZXR1cm4gKG4gJiAobiAtIDEpKSA9PSAwO1xufTtcblxuLyoqXG4gKiBSZXR1cm5zIHRoZSBuZXh0IGhpZ2hlc3QgcG93ZXItb2YtdHdvIGZyb20gdGhlIHNwZWNpZmllZCBudW1iZXIuIFxuICogXG4gKiBAcGFyYW0gIHtOdW1iZXJ9IG4gdGhlIG51bWJlciB0byB0ZXN0XG4gKiBAcmV0dXJuIHtOdW1iZXJ9ICAgdGhlIG5leHQgaGlnaGVzdCBwb3dlciBvZiB0d29cbiAqL1xuTnVtYmVyVXRpbC5uZXh0UG93ZXJPZlR3byA9IGZ1bmN0aW9uKG4pIHtcblx0bi0tO1xuXHRuIHw9IG4gPj4gMTtcblx0biB8PSBuID4+IDI7XG5cdG4gfD0gbiA+PiA0O1xuXHRuIHw9IG4gPj4gODtcblx0biB8PSBuID4+IDE2O1xuXHRyZXR1cm4gbisxO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBOdW1iZXJVdGlsOyIsIi8qXG4gKiByYWYuanNcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9uZ3J5bWFuL3JhZi5qc1xuICpcbiAqIG9yaWdpbmFsIHJlcXVlc3RBbmltYXRpb25GcmFtZSBwb2x5ZmlsbCBieSBFcmlrIE3DtmxsZXJcbiAqIGluc3BpcmVkIGZyb20gcGF1bF9pcmlzaCBnaXN0IGFuZCBwb3N0XG4gKlxuICogQ29weXJpZ2h0IChjKSAyMDEzIG5ncnltYW5cbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgbGljZW5zZS5cbiAqL1xuXG4oZnVuY3Rpb24od2luZG93KSB7XG5cdHZhciBsYXN0VGltZSA9IDAsXG5cdFx0dmVuZG9ycyA9IFsnd2Via2l0JywgJ21veiddLFxuXHRcdHJlcXVlc3RBbmltYXRpb25GcmFtZSA9IHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUsXG5cdFx0Y2FuY2VsQW5pbWF0aW9uRnJhbWUgPSB3aW5kb3cuY2FuY2VsQW5pbWF0aW9uRnJhbWUsXG5cdFx0aSA9IHZlbmRvcnMubGVuZ3RoO1xuXG5cdC8vIHRyeSB0byB1bi1wcmVmaXggZXhpc3RpbmcgcmFmXG5cdHdoaWxlICgtLWkgPj0gMCAmJiAhcmVxdWVzdEFuaW1hdGlvbkZyYW1lKSB7XG5cdFx0cmVxdWVzdEFuaW1hdGlvbkZyYW1lID0gd2luZG93W3ZlbmRvcnNbaV0gKyAnUmVxdWVzdEFuaW1hdGlvbkZyYW1lJ107XG5cdFx0Y2FuY2VsQW5pbWF0aW9uRnJhbWUgPSB3aW5kb3dbdmVuZG9yc1tpXSArICdDYW5jZWxBbmltYXRpb25GcmFtZSddO1xuXHR9XG5cblx0Ly8gcG9seWZpbGwgd2l0aCBzZXRUaW1lb3V0IGZhbGxiYWNrXG5cdC8vIGhlYXZpbHkgaW5zcGlyZWQgZnJvbSBAZGFyaXVzIGdpc3QgbW9kOiBodHRwczovL2dpc3QuZ2l0aHViLmNvbS9wYXVsaXJpc2gvMTU3OTY3MSNjb21tZW50LTgzNzk0NVxuXHRpZiAoIXJlcXVlc3RBbmltYXRpb25GcmFtZSB8fCAhY2FuY2VsQW5pbWF0aW9uRnJhbWUpIHtcblx0XHRyZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuXHRcdFx0dmFyIG5vdyA9IERhdGUubm93KCksIG5leHRUaW1lID0gTWF0aC5tYXgobGFzdFRpbWUgKyAxNiwgbm93KTtcblx0XHRcdHJldHVybiBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRjYWxsYmFjayhsYXN0VGltZSA9IG5leHRUaW1lKTtcblx0XHRcdH0sIG5leHRUaW1lIC0gbm93KTtcblx0XHR9O1xuXG5cdFx0Y2FuY2VsQW5pbWF0aW9uRnJhbWUgPSBjbGVhclRpbWVvdXQ7XG5cdH1cblxuXHQvLyBleHBvcnQgdG8gd2luZG93XG5cdHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWU7XG5cdHdpbmRvdy5jYW5jZWxBbmltYXRpb25GcmFtZSA9IGNhbmNlbEFuaW1hdGlvbkZyYW1lO1xufSh3aW5kb3cpKTsiLCJ2YXIgZG9tcmVhZHkgPSByZXF1aXJlKCdkb21yZWFkeScpO1xuXG52YXIgV2ViR0xDb250ZXh0ID0gcmVxdWlyZSgna2FtaScpLldlYkdMQ29udGV4dDtcbnZhciBUZXh0dXJlID0gcmVxdWlyZSgna2FtaScpLlRleHR1cmU7XG52YXIgU3ByaXRlQmF0Y2ggPSByZXF1aXJlKCdrYW1pJykuU3ByaXRlQmF0Y2g7XG52YXIgU2hhZGVyUHJvZ3JhbSA9IHJlcXVpcmUoJ2thbWknKS5TaGFkZXJQcm9ncmFtO1xudmFyIEZyYW1lQnVmZmVyID0gcmVxdWlyZSgna2FtaScpLkZyYW1lQnVmZmVyO1xudmFyIFRleHR1cmVSZWdpb24gPSByZXF1aXJlKCdrYW1pJykuVGV4dHVyZVJlZ2lvbjtcblxudmFyIEFzc2V0TG9hZGVyID0gcmVxdWlyZSgna2FtaS1hc3NldHMnKTtcblxudmFyIGZzID0gcmVxdWlyZSgnZnMnKTtcblxuLy9pbmNsdWRlIHBvbHlmaWxsIGZvciByZXF1ZXN0QW5pbWF0aW9uRnJhbWVcbnJlcXVpcmUoJ3JhZi5qcycpO1xuXG4vL0Jyb3dzZXJpZnkgcm9ja3MhIFdlIGNhbiBpbmxpbmUgb3VyIEdMU0wgbGlrZSBzbzogKGJyZnMgdHJhbnNmb3JtKVxudmFyIHZlcnQgPSBcIi8vaW5jb21pbmcgUG9zaXRpb24gYXR0cmlidXRlIGZyb20gb3VyIFNwcml0ZUJhdGNoXFxuYXR0cmlidXRlIHZlYzIgUG9zaXRpb247XFxuYXR0cmlidXRlIHZlYzQgQ29sb3I7XFxuYXR0cmlidXRlIHZlYzIgVGV4Q29vcmQwO1xcbnVuaWZvcm0gdmVjMiB1X3Byb2plY3Rpb247XFxudmFyeWluZyB2ZWMyIHZUZXhDb29yZDA7XFxudmFyeWluZyB2ZWM0IHZDb2xvcjtcXG5cXG52b2lkIG1haW4odm9pZCkge1xcbiAgIGdsX1Bvc2l0aW9uID0gdmVjNCggUG9zaXRpb24ueCAvIHVfcHJvamVjdGlvbi54IC0gMS4wLCBQb3NpdGlvbi55IC8gLXVfcHJvamVjdGlvbi55ICsgMS4wICwgMC4wLCAxLjApO1xcbiAgIHZUZXhDb29yZDAgPSBUZXhDb29yZDA7XFxuICAgdkNvbG9yID0gQ29sb3I7XFxufVwiO1xudmFyIGZyYWcgPSBcIiNpZmRlZiBHTF9FU1xcbnByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcbiNlbmRpZlxcblxcbi8vRmxhdCBzaGFkaW5nIGluIGZvdXIgc3RlcHNcXG4jZGVmaW5lIFNURVBfQSAwLjRcXG4jZGVmaW5lIFNURVBfQiAwLjZcXG4jZGVmaW5lIFNURVBfQyAwLjhcXG4jZGVmaW5lIFNURVBfRCAxLjBcXG5cXG4vL2F0dHJpYnV0ZXMgZnJvbSB2ZXJ0ZXggc2hhZGVyXFxudmFyeWluZyB2ZWM0IHZDb2xvcjtcXG52YXJ5aW5nIHZlYzIgdlRleENvb3JkMDtcXG5cXG4vL291ciB0ZXh0dXJlIHNhbXBsZXJzXFxudW5pZm9ybSBzYW1wbGVyMkQgdV90ZXh0dXJlMDsgICAvL2RpZmZ1c2UgbWFwXFxudW5pZm9ybSBzYW1wbGVyMkQgdV9ub3JtYWxzOyAgIC8vbm9ybWFsIG1hcFxcblxcbi8vdmFsdWVzIHVzZWQgZm9yIHNoYWRpbmcgYWxnb3JpdGhtLi4uXFxudW5pZm9ybSB2ZWMyIFJlc29sdXRpb247ICAgICAgLy9yZXNvbHV0aW9uIG9mIGNhbnZhc1xcbnVuaWZvcm0gdmVjNCBBbWJpZW50Q29sb3I7ICAgIC8vYW1iaWVudCBSR0JBIC0tIGFscGhhIGlzIGludGVuc2l0eSBcXG5cXG51bmlmb3JtIHZlYzMgTGlnaHRQb3M7ICAgICAvL2xpZ2h0IHBvc2l0aW9uLCBub3JtYWxpemVkXFxudW5pZm9ybSB2ZWM0IExpZ2h0Q29sb3I7ICAgLy9saWdodCBSR0JBIC0tIGFscGhhIGlzIGludGVuc2l0eVxcbnVuaWZvcm0gdmVjMyBGYWxsb2ZmOyAgICAgIC8vYXR0ZW51YXRpb24gY29lZmZpY2llbnRzXFxudW5pZm9ybSBmbG9hdCBMaWdodFNpemU7ICAgLy90aGUgbGlnaHQgZGlhbWV0ZXIgaW4gcGl4ZWxzXFxuXFxuLy8gdW5pZm9ybSBmbG9hdCBUZXN0WzJdO1xcblxcbnZvaWQgbWFpbigpIHtcXG5cXHQvL1JHQkEgb2Ygb3VyIGRpZmZ1c2UgY29sb3JcXG5cXHR2ZWM0IERpZmZ1c2VDb2xvciA9IHRleHR1cmUyRCh1X3RleHR1cmUwLCB2VGV4Q29vcmQwKTtcXG5cXHRcXG5cXHQvL1JHQiBvZiBvdXIgbm9ybWFsIG1hcFxcblxcdHZlYzMgTm9ybWFsTWFwID0gdGV4dHVyZTJEKHVfbm9ybWFscywgdlRleENvb3JkMCkucmdiO1xcblxcdFxcblxcdC8vVGhlIGRlbHRhIHBvc2l0aW9uIG9mIGxpZ2h0XFxuXFx0dmVjMyBMaWdodERpciA9IHZlYzMoTGlnaHRQb3MueHkgLSAoZ2xfRnJhZ0Nvb3JkLnh5IC8gUmVzb2x1dGlvbi54eSksIExpZ2h0UG9zLnopO1xcblxcdFxcblxcdC8vV2UgZW5zdXJlIGEgZml4ZWQgbGlnaHQgc2l6ZSBpbiBwaXhlbHMgbGlrZSBzbzpcXG5cXHRMaWdodERpci54IC89IChMaWdodFNpemUgLyBSZXNvbHV0aW9uLngpO1xcblxcdExpZ2h0RGlyLnkgLz0gKExpZ2h0U2l6ZSAvIFJlc29sdXRpb24ueSk7XFxuXFxuXFx0Ly9EZXRlcm1pbmUgZGlzdGFuY2UgKHVzZWQgZm9yIGF0dGVudWF0aW9uKSBCRUZPUkUgd2Ugbm9ybWFsaXplIG91ciBMaWdodERpclxcblxcdGZsb2F0IEQgPSBsZW5ndGgoTGlnaHREaXIpO1xcblxcdFxcblxcdC8vbm9ybWFsaXplIG91ciB2ZWN0b3JzXFxuXFx0dmVjMyBOID0gbm9ybWFsaXplKE5vcm1hbE1hcCAqIDIuMCAtIDEuMCk7XFxuXFx0dmVjMyBMID0gbm9ybWFsaXplKExpZ2h0RGlyKTtcXG5cXG5cXHQvL1dlIGNhbiByZWR1Y2UgdGhlIGludGVuc2l0eSBvZiB0aGUgbm9ybWFsIG1hcCBsaWtlIHNvOlxcdFxcdFxcblxcdE4gPSBtaXgoTiwgdmVjMygwKSwgMC41KTtcXG5cXG5cXHQvL1NvbWUgbm9ybWFsIG1hcHMgbWF5IG5lZWQgdG8gYmUgaW52ZXJ0ZWQgbGlrZSBzbzpcXG5cXHQvLyBOLnkgPSAxLjAgLSBOLnk7XFxuXFx0XFxuXFx0Ly9wZXJmb3JtIFxcXCJOIGRvdCBMXFxcIiB0byBkZXRlcm1pbmUgb3VyIGRpZmZ1c2UgdGVybVxcblxcdGZsb2F0IGRmID0gbWF4KGRvdChOLCBMKSwgMC4wKTtcXG5cXG5cXHQvL1ByZS1tdWx0aXBseSBsaWdodCBjb2xvciB3aXRoIGludGVuc2l0eVxcblxcdHZlYzMgRGlmZnVzZSA9IChMaWdodENvbG9yLnJnYiAqIExpZ2h0Q29sb3IuYSkgKiBkZjtcXG5cXG5cXHQvL3ByZS1tdWx0aXBseSBhbWJpZW50IGNvbG9yIHdpdGggaW50ZW5zaXR5XFxuXFx0dmVjMyBBbWJpZW50ID0gQW1iaWVudENvbG9yLnJnYiAqIEFtYmllbnRDb2xvci5hO1xcblxcdFxcblxcdC8vY2FsY3VsYXRlIGF0dGVudWF0aW9uXFxuXFx0ZmxvYXQgQXR0ZW51YXRpb24gPSAxLjAgLyAoIEZhbGxvZmYueCArIChGYWxsb2ZmLnkqRCkgKyAoRmFsbG9mZi56KkQqRCkgKTtcXG5cXG5cXHQvL0hlcmUgaXMgd2hlcmUgd2UgYXBwbHkgc29tZSB0b29uIHNoYWRpbmcgdG8gdGhlIGxpZ2h0XFxuXFx0aWYgKEF0dGVudWF0aW9uIDwgU1RFUF9BKSBcXG5cXHRcXHRBdHRlbnVhdGlvbiA9IDAuMDtcXG5cXHRlbHNlIGlmIChBdHRlbnVhdGlvbiA8IFNURVBfQikgXFxuXFx0XFx0QXR0ZW51YXRpb24gPSBTVEVQX0I7XFxuXFx0ZWxzZSBpZiAoQXR0ZW51YXRpb24gPCBTVEVQX0MpIFxcblxcdFxcdEF0dGVudWF0aW9uID0gU1RFUF9DO1xcblxcdGVsc2UgXFxuXFx0XFx0QXR0ZW51YXRpb24gPSBTVEVQX0Q7XFxuXFxuXFx0Ly90aGUgY2FsY3VsYXRpb24gd2hpY2ggYnJpbmdzIGl0IGFsbCB0b2dldGhlclxcblxcdHZlYzMgSW50ZW5zaXR5ID0gQW1iaWVudCArIERpZmZ1c2UgKiBBdHRlbnVhdGlvbjtcXG5cXHR2ZWMzIEZpbmFsQ29sb3IgPSBEaWZmdXNlQ29sb3IucmdiICogSW50ZW5zaXR5O1xcblxcblxcdC8vIGdsX0ZyYWdDb2xvciA9IHZlYzQodmVjMyhMaWdodERpci54KSwgMS4wKTtcXG5cXHRnbF9GcmFnQ29sb3IgPSB2Q29sb3IgKiB2ZWM0KEZpbmFsQ29sb3IsIERpZmZ1c2VDb2xvci5hKTtcXG59XCI7XG5cblxudmFyIFVQU0NBTEUgPSAzO1xuXG5kb21yZWFkeShmdW5jdGlvbigpIHtcbiAgICAvL0NyZWF0ZSBhIG5ldyBXZWJHTCBjYW52YXMgd2l0aCB0aGUgZ2l2ZW4gc2l6ZVxuICAgIHZhciBjb250ZXh0ID0gbmV3IFdlYkdMQ29udGV4dCgxMDI0LCAxMDI0KTtcblxuICAgIC8vdGhlICd2aWV3JyBpcyB0aGUgRE9NIGNhbnZhcywgc28gd2UgY2FuIGp1c3QgYXBwZW5kIGl0IHRvIG91ciBib2R5XG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCggY29udGV4dC52aWV3ICk7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS5vdmVyZmxvdyA9IFwiaGlkZGVuXCI7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS5tYXJnaW4gPSBcIjBcIjtcbiAgICBkb2N1bWVudC5ib2R5LnN0eWxlLmJhY2tncm91bmQgPSBcImJsYWNrXCI7XG5cbiAgICBhZGRDcmVkaXRzKCk7XG5cbiAgICAvL1dlIHVzZSBTcHJpdGVCYXRjaCB0byBkcmF3IHRleHR1cmVzIGFzIDJEIHF1YWRzXG4gICAgdmFyIGJhdGNoID0gbmV3IFNwcml0ZUJhdGNoKGNvbnRleHQpO1xuXG4gICAgLy9DcmVhdGUgb3VyIHRleHR1cmUuIFdoZW4gdGhlIGRpZmZ1c2UgaXMgbG9hZGVkLCB3ZSBjYW4gc2V0dXAgb3VyIEZCTyBhbmQgc3RhcnQgcmVuZGVyaW5nXG4gICAgdmFyIHRleE5vcm1hbCAgPSBuZXcgVGV4dHVyZShjb250ZXh0LCBcImltZy9waXhlbC1ub3JtYWxzLnBuZ1wiKTtcbiAgICB2YXIgdGV4RGlmZnVzZSA9IG5ldyBUZXh0dXJlKGNvbnRleHQsIFwiaW1nL3BpeGVsLWRpZmZ1c2UucG5nXCIsIHN0YXJ0KTtcblxuICAgIC8vdGhlIGRlZmF1bHQgbGlnaHQgWiBwb3NpdGlvblxuICAgIHZhciBsaWdodFogPSAwLjA3NSxcbiAgICAgICAgbGlnaHRTaXplID0gMjU2OyAvL1NvIHRoZSBsaWdodCBzaXplIGlzIGluZGVwZW5kZW50IG9mIGNhbnZhcyByZXNvbHV0aW9uXG5cbiAgICAvL3BhcmFtZXRlcnMgZm9yIHRoZSBsaWdodGluZyBzaGFkZXJcbiAgICB2YXIgYW1iaWVudENvbG9yID0gbmV3IEZsb2F0MzJBcnJheShbMC44LCAwLjgsIDAuOCwgMC4zXSk7XG4gICAgdmFyIGxpZ2h0Q29sb3IgPSBuZXcgRmxvYXQzMkFycmF5KFsxLjAsIDEuMCwgMS4wLCAxLjBdKTtcbiAgICB2YXIgZmFsbG9mZiA9IG5ldyBGbG9hdDMyQXJyYXkoWzAuNCwgNy4wLCAzMC4wXSk7XG4gICAgdmFyIGxpZ2h0UG9zID0gbmV3IEZsb2F0MzJBcnJheShbMCwgMCwgbGlnaHRaXSk7XG5cblxuICAgIC8vc2V0dXAgb3VyIHNoYWRlclxuICAgIHZhciBzaGFkZXIgPSBuZXcgU2hhZGVyUHJvZ3JhbShjb250ZXh0LCB2ZXJ0LCBmcmFnKTtcbiAgICBpZiAoc2hhZGVyLmxvZylcbiAgICAgICAgY29uc29sZS53YXJuKHNoYWRlci5sb2cpO1xuXG4gICAgLy9ub3RpY2UgaG93IHdlIGJpbmQgb3VyIHNoYWRlciBiZWZvcmUgc2V0dGluZyB1bmlmb3JtcyFcbiAgICBzaGFkZXIuYmluZCgpO1xuICAgIHNoYWRlci5zZXRVbmlmb3JtaShcInVfbm9ybWFsc1wiLCAxKTtcbiAgICBzaGFkZXIuc2V0VW5pZm9ybWYoXCJMaWdodFNpemVcIiwgbGlnaHRTaXplKTtcblxuICAgIHZhciBmYm8gPSBudWxsLFxuICAgICAgICBmYm9SZWdpb24gPSBudWxsLFxuICAgICAgICBtb3VzZSA9IHt4OjAsIHk6IC0xfSwgLy9zdGFydCB0aGUgbGlnaHQgb2ZmLXNjcmVlbi4uLlxuICAgICAgICBzY3JvbGwgPSAwLFxuICAgICAgICB0aW1lICAgPSAwO1xuXG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZW1vdmVcIiwgZnVuY3Rpb24oZXYpIHtcbiAgICAgICAgaWYgKCFmYm8pXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgLy9TaW5jZSB3ZSBmbGlwcGVkIHRoZSBGQk8gcmVnaW9uLCB3ZSBuZWVkIHRvIGFjY29tb2RhdGUgZm9yIHRoYXQuXG4gICAgICAgIC8vV2UgYWxzbyBuZWVkIHRvIGFkanVzdCBmb3IgdGhlIGFtb3VudCB3ZSBhcmUgc2NhbGluZyB0aGUgRkJPXG4gICAgICAgIC8vVGhpcyBpcyBiZWNhdXNlIHdlIHVzZSBnbF9GcmFnQ29vcmQgaW4gdGhlIHNoYWRlclxuICAgICAgICB2YXIgdyA9IGZiby53aWR0aCAqIFVQU0NBTEU7XG4gICAgICAgIHZhciBoID0gZmJvLmhlaWdodCAqIFVQU0NBTEU7XG5cbiAgICAgICAgbW91c2UueCA9IGV2LnBhZ2VYIC8gdztcbiAgICAgICAgbW91c2UueSA9IChoIC0gZXYucGFnZVkpIC8gaDtcbiAgICAgICAgXG4gICAgfSwgdHJ1ZSk7XG5cbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcInJlc2l6ZVwiLCBmdW5jdGlvbihldikge1xuICAgICAgICBjb250ZXh0LnJlc2l6ZSh3aW5kb3cuaW5uZXJXaWR0aCwgd2luZG93LmlubmVySGVpZ2h0KTtcbiAgICB9LCB0cnVlKTtcblxuICAgIHZhciBsYXN0VGltZSA9IDAsXG4gICAgICAgIG5vdyA9IERhdGUubm93KCk7XG5cblxuICAgIC8vQ3JlYXRlcyB0aGUgRkJPIHRleHR1cmUgYW5kIHN0YXJ0cyB0aGUgcmVuZGVyIGxvb3BcbiAgICBmdW5jdGlvbiBzdGFydCgpIHtcbiAgICAgICAgLy9UbyBnZXQgY3Jpc3AgZWRnZXMgb24gc3ByaXRlcyBhbmQgdGhlIGxpZ2h0cywgd2UgcmVuZGVyIG91ciBzY2VuZSB0byBhIHNtYWxsIGJ1ZmZlciwgXG4gICAgICAgIC8vYW5kIHRoZW4gdXAtc2NhbGUgaXQgd2l0aCBuZWFyZXN0LW5laWdoYm91ciBzY2FsaW5nLiBUaGlzIHNob3VsZCBiZSBmYXN0ZXIgc2luY2Ugd2UgXG4gICAgICAgIC8vYXJlbid0IHByb2Nlc3NpbmcgYXMgbWFueSBmcmFnbWVudHMgd2l0aCBvdXIgbGlnaHRpbmcgc2hhZGVyLlxuICAgICAgICBcbiAgICAgICAgLy9XZSBuZWVkIHRvIHdhaXQgdW50aWwgdGhlIHRleHR1cmUgaXMgbG9hZGVkIHRvIGRldGVybWluZSBpdHMgc2l6ZS5cbiAgICAgICAgZmJvID0gbmV3IEZyYW1lQnVmZmVyKGNvbnRleHQsIHRleERpZmZ1c2Uud2lkdGgsIHRleERpZmZ1c2UuaGVpZ2h0KVxuICAgICAgICBcbiAgICAgICAgLy9XZSBub3cgdXNlIGEgcmVnaW9uIHRvIGZsaXAgdGhlIHRleHR1cmUgY29vcmRpbmF0ZXMsIHNvIGl0IGFwcGVhcnMgdXByaWdodCBsaWtlIG5vcm1hbFxuICAgICAgICBmYm9SZWdpb24gPSBuZXcgVGV4dHVyZVJlZ2lvbihmYm8udGV4dHVyZSk7XG4gICAgICAgIGZib1JlZ2lvbi5mbGlwKGZhbHNlLCB0cnVlKTtcblxuICAgICAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUocmVuZGVyKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBkcmF3U2NlbmUoZGVsdGEsIGJ1ZmZlcikge1xuXG4gICAgICAgIHZhciB0ZXhXaWR0aCA9IHRleERpZmZ1c2Uud2lkdGgsXG4gICAgICAgICAgICB0ZXhIZWlnaHQgPSB0ZXhEaWZmdXNlLmhlaWdodDtcblxuICAgICAgICAvL2hlcmUgd2UgYW5pbWF0ZSB0aGUgbGlnaHQgZmFsbG9mZiBhIGJpdFxuICAgICAgICB0aW1lICs9IDAuMjUgKiBkZWx0YTtcbiAgICAgICAgZmFsbG9mZlsyXSA9IDMwIC0gKE1hdGguc2luKHRpbWUpLzIrMC41KSoxNTtcbiAgICAgICAgXG4gICAgICAgIC8vdGhlIGZpcnN0IGxpZ2h0IHdpbGwgYmUgYmFzZWQgb24gbW91c2VcbiAgICAgICAgbGlnaHRQb3NbMF0gPSBtb3VzZS54O1xuICAgICAgICBsaWdodFBvc1sxXSA9IG1vdXNlLnk7XG5cbiAgICAgICAgLy93ZSBuZWVkIHRvIHNldCB0aGUgc2hhZGVyIG9mIG91ciBiYXRjaC4uLlxuICAgICAgICBiYXRjaC5zaGFkZXIgPSBzaGFkZXI7XG5cbiAgICAgICAgLy9XZSBuZWVkIHRvIHJlc2l6ZSB0aGUgYmF0Y2ggdG8gdGhlIHNpemUgb2YgdGhlIGJ1ZmZlciB3ZSBhcmUgZHJhd2luZyB0byxcbiAgICAgICAgLy9pbiB0aGlzIGNhc2Ugb3VyIEZCT1xuICAgICAgICBiYXRjaC5yZXNpemUoYnVmZmVyLndpZHRoLCBidWZmZXIuaGVpZ2h0KTtcblxuICAgICAgICAvL05vdyB3ZSBuZWVkIHRvIGRyYXcgb3VyIHNwcml0ZXMgd2l0aCB0aGUgbGlnaHRpbmcgc2hhZGVyLlxuICAgICAgICBcbiAgICAgICAgLy90aGlzIHdpbGwgYmluZCBvdXIgc2hhZGVyXG4gICAgICAgIGJhdGNoLmJlZ2luKCk7XG5cbiAgICAgICAgLy9wYXNzIG91ciBwYXJhbWV0ZXJzIHRvIHRoZSBzaGFkZXIuIGdsVW5pZm9ybSBoYXMgdG8gYmUgY2FsbGVkIGFmdGVyIHRoZSBzaGFkZXIgaXMgYm91bmQhXG4gICAgICAgIC8vTm90aWNlIHRoZSByZXNvbHV0aW9uIGFuZCBsaWdodCBwb3NpdGlvbiBhcmUgbm9ybWFsaXplZCB0byB0aGUgV2ViR0wgY2FudmFzIHNpemVcbiAgICAgICAgc2hhZGVyLnNldFVuaWZvcm1mKFwiUmVzb2x1dGlvblwiLCBmYm8ud2lkdGgsIGZiby5oZWlnaHQpO1xuICAgICAgICBzaGFkZXIuc2V0VW5pZm9ybWZ2KFwiQW1iaWVudENvbG9yXCIsIGFtYmllbnRDb2xvcik7XG4gICAgICAgIHNoYWRlci5zZXRVbmlmb3JtZnYoXCJMaWdodFBvc1wiLCBsaWdodFBvcyk7XG4gICAgICAgIHNoYWRlci5zZXRVbmlmb3JtZnYoXCJGYWxsb2ZmXCIsIGZhbGxvZmYpO1xuICAgICAgICBzaGFkZXIuc2V0VW5pZm9ybWZ2KFwiTGlnaHRDb2xvclwiLCBsaWdodENvbG9yKTtcblxuICAgICAgICB0ZXhOb3JtYWwuYmluZCgxKTsgIC8vYmluZCBub3JtYWxzIHRvIHVuaXQgMVxuICAgICAgICB0ZXhEaWZmdXNlLmJpbmQoMCk7IC8vYmluZCBkaWZmdXNlIHRvIHVuaXQgMFxuXG4gICAgICAgIC8vRHJhdyBlYWNoIHNwcml0ZSBoZXJlLi4uXG4gICAgICAgIC8vWW91IGNhbiB1c2Ugc3ByaXRlIHNoZWV0cyBhcyBsb25nIGFzIGRpZmZ1c2UgJiBub3JtYWwgcmVnaW9ucyBtYXRjaFxuICAgICAgICBiYXRjaC5kcmF3KHRleERpZmZ1c2UsIDAsIDAsIHRleFdpZHRoLCB0ZXhIZWlnaHQpO1xuXG4gICAgICAgIGJhdGNoLmVuZCgpOyBcbiAgICB9XG5cbiAgICBmdW5jdGlvbiByZW5kZXIoKSB7XG4gICAgICAgIHJlcXVlc3RBbmltYXRpb25GcmFtZShyZW5kZXIpO1xuXG4gICAgICAgIC8vZ2V0IGRlbHRhIHRpbWUgZm9yIHNtb290aCBhbmltYXRpb25cbiAgICAgICAgbm93ID0gRGF0ZS5ub3coKTtcbiAgICAgICAgdmFyIGRlbHRhID0gKG5vdyAtIGxhc3RUaW1lKSAvIDEwMDA7XG4gICAgICAgIGxhc3RUaW1lID0gbm93O1xuXG4gICAgICAgIHZhciBnbCA9IGNvbnRleHQuZ2w7XG5cbiAgICAgICAgLy9GaXJzdCwgY2xlYXIgdGhlIG1haW4gYnVmZmVyICh0aGUgc2NyZWVuKVxuICAgICAgICBnbC5jbGVhcihnbC5DT0xPUl9CVUZGRVJfQklUKTtcblxuICAgICAgICAvL3N0YXJ0IHJlbmRlcmluZyB0byBvdXIgRkJPXG4gICAgICAgIGZiby5iZWdpbigpO1xuXG4gICAgICAgIC8vTm93IHdlIG5lZWQgdG8gY2xlYXIgdGhlIG9mZi1zY3JlZW4gYnVmZmVyIVxuICAgICAgICBnbC5jbGVhcihnbC5DT0xPUl9CVUZGRVJfQklUKTtcblxuICAgICAgICAvL2RyYXcgdGhlIHNjZW5lIHRvIG91ciBidWZmZXJcbiAgICAgICAgZHJhd1NjZW5lKGRlbHRhLCBmYm8pO1xuXG4gICAgICAgIC8vc3RvcCByZW5kZXJpbmcgdG8gRkJPLCBhbmQgbWFrZSB0aGUgc2NyZWVuIHRoZSBtYWluIGJ1ZmZlclxuICAgICAgICBmYm8uZW5kKCk7XG5cbiAgICAgICAgLy9yZXNldCB0byBkZWZhdWx0IHNoYWRlclxuICAgICAgICBiYXRjaC5zaGFkZXIgPSBiYXRjaC5kZWZhdWx0U2hhZGVyO1xuXG4gICAgICAgIC8vc2V0IHRoZSBiYXRjaCB0byB0aGUgc2NyZWVuIHNpemVcbiAgICAgICAgYmF0Y2gucmVzaXplKGNvbnRleHQud2lkdGgsIGNvbnRleHQuaGVpZ2h0KTtcblxuICAgICAgICAvL25vdyB3ZSBqdXN0IGRyYXcgaXQgdG8gdGhlIHNjcmVlbiwgdXBzY2FsZWRcbiAgICAgICAgYmF0Y2guYmVnaW4oKTtcbiAgICAgICAgYmF0Y2guZHJhd1JlZ2lvbihmYm9SZWdpb24sIDAsIDAsIGZiby53aWR0aCAqIFVQU0NBTEUsIGZiby5oZWlnaHQgKiBVUFNDQUxFKVxuICAgICAgICBiYXRjaC5lbmQoKTtcbiAgICB9XG5cbn0pO1xuXG5mdW5jdGlvbiBhZGRDcmVkaXRzKCkgeyAvLy4uIEkgc2hvdWxkIHByb2JhYmx5IGluY2x1ZGUgdGhpcyBpbiB0aGUgSFRNTCB0ZW1wbGF0ZVxuICAgIHZhciB0ZXh0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICB0ZXh0LmNsYXNzTmFtZSA9IFwiY3JlZGl0c1wiO1xuICAgIHRleHQuaW5uZXJIVE1MID0gJzxkaXY+PGEgaHJlZj1cImh0dHBzOi8vZ2l0aHViLmNvbS9tYXR0ZGVzbC9rYW1pLWRlbW9zXCI+a2FtaS1kZW1vczwvYT48L2Rpdj4nXG4gICAgICAgICAgICAgICAgKydwbGF0Zm9ybWVyIGFydCBieSA8YSBocmVmPVwiaHR0cDovL29wZW5nYW1lYXJ0Lm9yZy9jb250ZW50L3BsYXRmb3JtZXItYXJ0LXBpeGVsLWVkaXRpb25cIj5LZW5uZXk8L2E+JztcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRleHQpO1xufSJdfQ==
