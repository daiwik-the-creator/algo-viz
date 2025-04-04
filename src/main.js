let tx = 0, ty = 0, tz = 0;
let sx = 1, sy = 1, sz = 1;
let radius = 5;           // Distance from the center
let azimuth = 580;//-50;          // Yaw (left-right)
let elevation = -20;       // Pitch (up-down)
let isMouseDown = false;
let lastX, lastY;

document.addEventListener("mousedown", (e) => {
    isMouseDown = true;
    lastX = e.clientX;
    lastY = e.clientY;
});
document.addEventListener("mouseup", () => isMouseDown = false);
document.addEventListener("mousemove", (e) => {
    if (!isMouseDown) return;

    let deltaX = e.clientX - lastX;
    let deltaY = e.clientY - lastY;

    azimuth += deltaX * 0.5;    // horizontal rotation
    elevation -= deltaY * 0.5;  // vertical rotation

    elevation = Math.max(-89, Math.min(89, elevation)); // Clamp elevation

    lastX = e.clientX;
    lastY = e.clientY;
});

document.addEventListener("wheel", (e) => {
    radius += e.deltaY * 0.01;
    radius = Math.max(1, radius); // Prevent zooming through the origin
});

function getCameraPosition() {
    const radAzimuth = azimuth * Math.PI / 180;
    const radElevation = elevation * Math.PI / 180;

    const x = radius * Math.cos(radElevation) * Math.sin(radAzimuth);
    const y = radius * Math.sin(radElevation);
    const z = radius * Math.cos(radElevation) * Math.cos(radAzimuth);

    return vec3(x, y, z);
}

var vertexShaderSource = `
    precision mediump float;

    attribute vec3 aPosition;       // Position of the vertex
    attribute vec2 aTexCoord;       // Texture coordinates (u, v)
    attribute vec3 aColor;          // Color of the vertex

    varying vec2 vTexCoord;         // To pass texture coordinates to fragment shader
    varying vec3 vColor;            // To pass color to fragment shader

    uniform mat4 uModelMatrix;      // Model matrix (world space)
    uniform mat4 uViewMatrix;       // View matrix (camera)
    uniform mat4 uProjectionMatrix; // Projection matrix (perspective)

    void main()
    {
        vColor = aColor;           // Pass color
        vTexCoord = aTexCoord;     // Pass texture coordinates
        gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPosition, 1.0);  // Apply transformations
    }

`;

var fragmentShaderSource = `
    precision mediump float;

    varying vec2 vTexCoord;         // Texture coordinates passed from vertex shader
    varying vec3 vColor;            // Color passed from vertex shader

    uniform sampler2D uTexture;     // Texture sampler

    uniform bool uUseTexture;       // Flag to determine whether to use texture

    void main() {
        if (uUseTexture) {
            // Use texture if uUseTexture is true
            gl_FragColor = texture2D(uTexture, vTexCoord) * vec4(vColor, 1.0);
        } else {
            // Use color if no texture is applied
            gl_FragColor = vec4(vColor, 1.0);
        }
    }
`;


const arrowVertices = [
    // X-Axis Arrow (Triangle at end)
    1.2,  0.05,  0.0,  1, 0, 0,
    1.2, -0.05,  0.0,  1, 0, 0,
    1.3,  0.0,   0.0,  1, 0, 0,

    // Y-Axis Arrow (Triangle at end)
    0.05,  1.2,  0.0,  0, 1, 0,
   -0.05,  1.2,  0.0,  0, 1, 0,
    0.0,   1.3,  0.0,  0, 1, 0,

    // Z-Axis Arrow (Triangle at end)
    0.05,  0.0,  1.2,  0, 0, 1,
   -0.05,  0.0,  1.2,  0, 0, 1,
    0.0,   0.05, 1.3,  0, 0, 1
];

// Drawing Grids and Points
const axisVertices = [
    // X-Axis (Red)
    -1.0, 0.0, 0.0,  1, 0, 0,  // Start (Red)
     1.0, 0.0, 0.0,  1, 0, 0,  // End (Red)

    // Y-Axis (Green)
    0.0, -1.0, 0.0,  0, 1, 0,  // Start (Green)
    0.0,  1.0, 0.0,  0, 1, 0,  // End (Green)

    // Z-Axis (Blue)
    0.0, 0.0, -1.0,  0, 0, 1,  // Start (Blue)
    0.0, 0.0,  1.0,  0, 0, 1,  // End (Blue)
];

const gridSize = 2.0;  // Grid extends from -1 to 1
const gridStep = 0.2;  // Spacing of grid lines
let gridVertices = [];

// X-Z Plane Grid (Y = 0)
for (let i = -gridSize; i <= gridSize; i += gridStep) {
    gridVertices.push(i, 0, -gridSize,  0.5, 0.5, 0.5);
    gridVertices.push(i, 0,  gridSize,  0.5, 0.5, 0.5);

    gridVertices.push(-gridSize, 0, i,  0.5, 0.5, 0.5);
    gridVertices.push(gridSize, 0, i,  0.5, 0.5, 0.5);
}

const { vertices: sphereVertices, indices: sphereIndices, textureCoordinates: sphereUv} = generateSphere(0.2, 32, 32);
const { vertices: centroidVertices, indices: centroidIndices, textureCoordinates: centroidUv} = generateSphere(0.8, 32, 32);

window.onload = function init(){

    var canvas = document.getElementById('game-surface');
    var gl = canvas.getContext('webgl2');

    if (!gl) {
        alert("Browser does not support WebGL");
    }

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, window.innerWidth, window.innerHeight);

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    // Create Shaders
    var vertexShader = gl.createShader(gl.VERTEX_SHADER);
    var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);

    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.shaderSource(fragmentShader, fragmentShaderSource);

    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        console.log('ERROR compiling vertex shader!', gl.getShaderInfoLog(vertexShader));
        return;
    }

    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        console.log('ERROR compiling fragment shader!', gl.getShaderInfoLog(fragmentShader));
        return;
    }

    var program = gl.createProgram();
    texture = loadTexture(gl, '1tex.jpg'); // Replace with your texture URL
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('ERROR linking program!', gl.getProgramInfoLog(program));
        return;
    }

    gl.validateProgram(program);
    if (!gl.getProgramParameter(program, gl.VALIDATE_STATUS)) {
        console.error('ERROR validating program!', gl.getProgramInfoLog(program));
        return;
    }  

    // Arrow Buffer
    const arrowBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, arrowBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arrowVertices), gl.STATIC_DRAW);

    // Axis Buffer
    const axisBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, axisBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(axisVertices), gl.STATIC_DRAW);

    // Grid Buffer
    const gridBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, gridBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(gridVertices), gl.STATIC_DRAW);

    var positionAttributeLocation = gl.getAttribLocation(program, 'aPosition');
    var texCoordAttributeLocation = gl.getAttribLocation(program, 'aTexCoord');
    var colorAttributeLocation = gl.getAttribLocation(program, 'aColor');

    // Tell OpenGL state machine which program should be active. 
    gl.useProgram(program);

    // Get uniform locations
    var matWorldUniformLocation = gl.getUniformLocation(program, 'uModelMatrix');
    var matViewUniformLocation = gl.getUniformLocation(program, 'uViewMatrix');
    var matProjUniformLocation = gl.getUniformLocation(program, 'uProjectionMatrix');
    var textureUniformLocation = gl.getUniformLocation(program, 'uTexture');
    var useTextureUniformLocation = gl.getUniformLocation(program, 'uUseTexture');  // Added uniform for texture flag

    let cameraPos = vec3(2, 2, 2); // returns [x, y, z]
    let target = vec3(0, 0, 0);              // Orbiting around origin
    let up = vec3(0, 1, 0);

    // Define transformation matrices
    var worldMatrix = mat4();  // Identity matrix by default
    var viewMatrix =  lookAt(cameraPos, target, up);  // LookAt function in MV.js
    var projMatrix = perspective(45, canvas.width / canvas.height, 0.1, 1000.0);  // Perspective matrix in MV.js

    // Pass matrices to WebGL
    gl.uniformMatrix4fv(matWorldUniformLocation, gl.FALSE, flatten(worldMatrix));
    gl.uniformMatrix4fv(matViewUniformLocation, gl.FALSE, flatten(viewMatrix));
    gl.uniformMatrix4fv(matProjUniformLocation, gl.FALSE, flatten(projMatrix));

    // Set texture (you may need to activate the texture and set it before rendering)
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(textureUniformLocation, 0);  // Bind texture to texture unit 0

    // Set the texture usage flag to false
    gl.uniform1i(useTextureUniformLocation, false);

    const sphereBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sphereVertices), gl.STATIC_DRAW);

    const sphereIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(sphereIndices), gl.STATIC_DRAW);

    const centroidBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, centroidBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(centroidVertices), gl.STATIC_DRAW);

    const centroidIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, centroidIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(centroidIndices), gl.STATIC_DRAW);

    // Create buffer for texture coordinates
    let textureCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sphereUv), gl.STATIC_DRAW);
    
    // Main Render Loop
var loop = function() {
    // === Orbit Camera Setup ===
    let radAzimuth = azimuth * Math.PI / 180;
    let radElevation = elevation * Math.PI / 180;

    let cameraX = radius * Math.cos(radElevation) * Math.sin(radAzimuth);
    let cameraY = radius * Math.sin(radElevation);
    let cameraZ = radius * Math.cos(radElevation) * Math.cos(radAzimuth);
    let cameraPos = vec3(-cameraX, -cameraY, cameraZ);

    let viewMatrix = lookAt(cameraPos, vec3(0, 0, 0), vec3(0, 1, 0));
    let projMatrix = perspective(45, canvas.width / canvas.height, 0.1, 100.0);

    // Upload view and projection
    gl.uniformMatrix4fv(matViewUniformLocation, false, flatten(viewMatrix));
    gl.uniformMatrix4fv(matProjUniformLocation, false, flatten(projMatrix));

    // TRANSLATION matrix
    let translationMatrix = translate(tx, ty, tz);

    // SCALE matrix
    let scaleMatrix = scale(sx, sy, sz);

    // Combine translation and scale
    worldMatrix = mult(translationMatrix, scaleMatrix);

    // Upload the transformation matrix
    gl.uniformMatrix4fv(matWorldUniformLocation, gl.FALSE, flatten(worldMatrix));
        
    // Set background color
    gl.clearColor(30 / 255, 30 / 255, 30 / 255, 1.0);
    gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);
        
    // Draw Grid (without texture)
    gl.bindBuffer(gl.ARRAY_BUFFER, gridBuffer);
    gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, gl.FALSE, 6 * Float32Array.BYTES_PER_ELEMENT, 0);
    gl.vertexAttribPointer(colorAttributeLocation, 3, gl.FLOAT, gl.FALSE, 6 * Float32Array.BYTES_PER_ELEMENT, 3 * Float32Array.BYTES_PER_ELEMENT);
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.enableVertexAttribArray(colorAttributeLocation);
    // gl.disableVertexAttribArray(texCoordAttributeLocation); // Disable texture coords for grid
    gl.drawArrays(gl.LINES, 0, gridVertices.length / 6);

    // Draw Axes (without texture)
    gl.bindBuffer(gl.ARRAY_BUFFER, axisBuffer);
    gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, gl.FALSE, 6 * Float32Array.BYTES_PER_ELEMENT, 0);
    gl.vertexAttribPointer(colorAttributeLocation, 3, gl.FLOAT, gl.FALSE, 6 * Float32Array.BYTES_PER_ELEMENT, 3 * Float32Array.BYTES_PER_ELEMENT);
    //gl.disableVertexAttribArray(texCoordAttributeLocation); // Disable texture coords for axes
    gl.drawArrays(gl.LINES, 0, axisVertices.length / 6);

    // Draw Arrowheads (without texture)
    gl.bindBuffer(gl.ARRAY_BUFFER, arrowBuffer);
    gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, gl.FALSE, 6 * Float32Array.BYTES_PER_ELEMENT, 0);
    gl.vertexAttribPointer(colorAttributeLocation, 3, gl.FLOAT, gl.FALSE, 6 * Float32Array.BYTES_PER_ELEMENT, 3 * Float32Array.BYTES_PER_ELEMENT);
    //gl.disableVertexAttribArray(texCoordAttributeLocation); // Disable texture coords for arrows
    gl.drawArrays(gl.TRIANGLES, 0, arrowVertices.length / 6);

    // 🌟 Draw Spheres (with texture)
    dataPoints.forEach(point => {
        // Compute local transformation for each sphere
        let localModelMatrix = mult(translate(point.x, point.y, point.z), scale(0.2, 0.2, 0.2));
        let finalModelMatrix = localModelMatrix;

        gl.uniformMatrix4fv(matWorldUniformLocation, gl.FALSE, flatten(finalModelMatrix));

        // Create color buffer for this sphere
        let sphereColors = [];
        for (let i = 0; i < sphereVertices.length / 3; i++) {
            sphereColors.push(point.r, point.g, point.b); // Assign color to each vertex
        }

        // Create color buffer only once per loop
        let sphereColorBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, sphereColorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sphereColors), gl.STATIC_DRAW);
        gl.vertexAttribPointer(colorAttributeLocation, 3, gl.FLOAT, gl.FALSE, 0, 0);
        gl.enableVertexAttribArray(colorAttributeLocation);

        // Bind the sphere vertex data
        gl.bindBuffer(gl.ARRAY_BUFFER, sphereBuffer);
        gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, gl.FALSE, 6 * Float32Array.BYTES_PER_ELEMENT, 0);
        gl.vertexAttribPointer(texCoordAttributeLocation, 2, gl.FLOAT, gl.FALSE, 6 * Float32Array.BYTES_PER_ELEMENT, 3 * Float32Array.BYTES_PER_ELEMENT);
        gl.enableVertexAttribArray(positionAttributeLocation);
        gl.enableVertexAttribArray(texCoordAttributeLocation);
        gl.uniform1i(useTextureUniformLocation, true);

        // Bind the texture for spheres
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(textureUniformLocation, 0); // Texture unit 0

        // Bind and draw the indexed geometry (sphere)
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereIndexBuffer);
        gl.drawElements(gl.TRIANGLES, sphereIndices.length, gl.UNSIGNED_SHORT, 0);

        gl.deleteBuffer(sphereColorBuffer);  // Cleanup after rendering
        gl.uniform1i(useTextureUniformLocation, false);
    });



    kMeans.centroids.forEach((point, index) => {

        // Apply transformations (worldMatrix affects all objects)
        let localModelMatrix = mult(translate(point[0], point[1], point[2]), scale(0.2, 0.2, 0.2));
        let finalModelMatrix = localModelMatrix;

        gl.uniformMatrix4fv(matWorldUniformLocation, gl.FALSE, flatten(finalModelMatrix));

        // Bind centroid buffer and set position attribute
        gl.bindBuffer(gl.ARRAY_BUFFER, centroidBuffer);
        gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, gl.FALSE, 6 * Float32Array.BYTES_PER_ELEMENT, 0);
        gl.enableVertexAttribArray(positionAttributeLocation);

        // Create and Bind Color Buffer (Fixing Color Assignment)
        const centroidColors = [];
        for (let i = 0; i < centroidVertices.length / 3; i++) {
            centroidColors.push(kMeans.clusterColors[index][0], kMeans.clusterColors[index][1], kMeans.clusterColors[index][2]); // Assign color for each vertex
        }

        const centroidColorBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, centroidColorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(centroidColors), gl.STATIC_DRAW);

        gl.vertexAttribPointer(colorAttributeLocation, 3, gl.FLOAT, gl.FALSE, 0, 0);
        gl.enableVertexAttribArray(colorAttributeLocation);

        // Bind element buffer and draw
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, centroidIndexBuffer);
        gl.drawElements(gl.TRIANGLES, centroidIndices.length, gl.UNSIGNED_SHORT, 0);

        // Cleanup color buffer to prevent memory leaks
        gl.deleteBuffer(centroidColorBuffer);
    });

        requestAnimationFrame(loop);
    }

    kMeans.initialize();
    requestAnimationFrame(loop);
};

function generateSphere(radius, latBands, longBands) {
    let vertices = [];
    let indices = [];
    let textureCoordinates = [];

    // Loop through each latitude band
    for (let lat = 0; lat <= latBands; lat++) {
        let theta = lat * Math.PI / latBands; // latitude angle
        let sinTheta = Math.sin(theta);
        let cosTheta = Math.cos(theta);

        // Loop through each longitude band
        for (let lon = 0; lon <= longBands; lon++) {
            let phi = lon * 2 * Math.PI / longBands; // longitude angle
            let sinPhi = Math.sin(phi);
            let cosPhi = Math.cos(phi);

            // Calculate vertex position
            let x = radius * sinTheta * cosPhi;
            let y = radius * cosTheta;
            let z = radius * sinTheta * sinPhi;

            // Push the vertex position to the vertices array
            vertices.push(x, y, z);

            // Calculate texture coordinates (u, v)
            let u = lon / longBands;
            let v = lat / latBands;
            textureCoordinates.push(u, v);
        }
    }

    // Create the indices for the sphere's triangles
    for (let lat = 0; lat < latBands; lat++) {
        for (let lon = 0; lon < longBands; lon++) {
            let first = lat * (longBands + 1) + lon;
            let second = first + longBands + 1;

            // Two triangles per latitude-longitude quad
            indices.push(first, second, first + 1);           // First triangle
            indices.push(second, second + 1, first + 1);     // Second triangle
        }
    }

    return {
        vertices: new Float32Array(vertices),
        indices: new Uint16Array(indices),
        textureCoordinates: new Float32Array(textureCoordinates),
    };
}

function loadTexture(gl, url) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Set default texture as a placeholder while the actual texture is being loaded
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 255, 255])); 

    const image = new Image();
    image.onload = function() {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

        // Mipmapping, set texture filtering if available
        gl.generateMipmap(gl.TEXTURE_2D);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    };

    image.src = url;

    return texture;
}
