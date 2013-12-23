//This defines the list of the different demos, where to find them, and some additional options

module.exports = [
    { name: 'basic', path: './src/basic/main.js' },
    { name: 'normals', path: './src/normals/main.js', transform: 'brfs' },
    { name: 'normals-pixel', path: './src/normals-pixel/main.js', transform: 'brfs' },
    { name: 'assets', path: './src/assets/main.js' },
	{ name: 'shockwave', path: './src/shockwave/main.js', transform: 'brfs' },
    { name: 'shaders-brfs', path: './src/shaders/brfs/main.js', transform: 'brfs' },
    { name: 's3tc', 
        path: './src/s3tc/main.js',
        scripts: './src/s3tc/vendor.html' },
    { name: 'shaders-script-tag', 
        path: './src/shaders/script-tag/main.js', 
        scripts: './src/shaders/script-tag/shaders.html' },
];