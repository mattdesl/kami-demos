//This defines the list of the different demos, where to find them, and some additional options

module.exports = [
    { name: 'basic', path: './src/basic/main.js' },
    { name: 'normals', path: './src/normals/main.js', 
        transform: 'brfs', scripts: './src/normals/fonts.html' },
    { name: 'assets', path: './src/assets/main.js' },
	{ name: 'shockwave', path: './src/shockwave/main.js', transform: 'brfs' },
    { name: 'shaders-brfs', path: './src/shaders/brfs/main.js', transform: 'brfs' },
    { name: 'shaders-script-tag', 
        path: './src/shaders/script-tag/main.js', 
        scripts: './src/shaders/script-tag/shaders.html' },
];