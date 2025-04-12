let tx = 0, ty = 0, tz = 0;
let sx = 1, sy = 1, sz = 1;
let radius = 5;           // Distance from the center
let azimuth = 580;//-50;          // Yaw (left-right)
let elevation = -20;       // Pitch (up-down)
let isMouseDown = false;
let lastX, lastY;
let lightingEnabled = true;
let textureEnabled = true;  

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

var vertexShaderSource = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;
in vec2 aTexCoord;
in vec3 aColor;

uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;

uniform vec3 uLightPosition;
uniform vec3 uViewPosition;

uniform vec3 uAmbientColor;
uniform vec3 uDiffuseColor;
uniform vec3 uSpecularColor;
uniform float uShininess;

out vec3 vLighting;
out vec2 vTexCoord;
out vec3 vColor;

void main() {
    vec4 posEye = uViewMatrix * uModelMatrix * vec4(aPosition, 1.0);
    vec3 N = normalize(mat3(transpose(inverse(uViewMatrix * uModelMatrix))) * aNormal);
    vec3 L = normalize(uLightPosition - posEye.xyz);
    vec3 V = normalize(uViewPosition - posEye.xyz);
    vec3 H = normalize(L + V);

    float diff = max(dot(N, L), 0.0);
    float spec = pow(max(dot(N, H), 0.0), uShininess);

    vLighting = uAmbientColor + diff * uDiffuseColor + spec * uSpecularColor;
    vTexCoord = aTexCoord;
    vColor = aColor;

    gl_Position = uProjectionMatrix * posEye;
}

`;
var fragmentShaderSource = `#version 300 es
precision mediump float;

in vec3 vLighting;
in vec2 vTexCoord;
in vec3 vColor;

uniform sampler2D uTexture;
uniform bool uUseTexture;
uniform bool uLightingEnabled;

out vec4 outColor;

void main() {
    vec3 texColor = uUseTexture ? texture(uTexture, vTexCoord).rgb : vec3(1.0);
    vec3 litColor = uLightingEnabled ? vLighting : vec3(1.0);
    vec3 finalColor = texColor * vColor * litColor;
    outColor = vec4(finalColor * 1.5, 1.0);
}
`;

const arrowVertices = [
    // X-Axis Arrow 
    1.2,  0.05,  0.0,  1, 0, 0,
    1.2, -0.05,  0.0,  1, 0, 0,
    1.3,  0.0,   0.0,  1, 0, 0,

    // Y-Axis Arrow 
    0.05,  1.2,  0.0,  0, 1, 0,
   -0.05,  1.2,  0.0,  0, 1, 0,
    0.0,   1.3,  0.0,  0, 1, 0,

    // Z-Axis Arrow 
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
    texture = loadTexture(gl, 'texture.jpg');
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
    var normalAttributeLocation = gl.getAttribLocation(program, 'aNormal');

    // Tell OpenGL state machine which program should be active. 
    gl.useProgram(program);

    // Get uniform locations
    let modelMatrixUniformLocation = gl.getUniformLocation(program, "uModelMatrix");
    let matViewUniformLocation = gl.getUniformLocation(program, "uViewMatrix");
    let matProjUniformLocation = gl.getUniformLocation(program, "uProjectionMatrix");
    
    let textureUniformLocation = gl.getUniformLocation(program, "uTexture");
    let lightPositionUniformLocation = gl.getUniformLocation(program, "uLightPosition");
    const lightingEnabledUniformLocation = gl.getUniformLocation(program, "uLightingEnabled");
    let viewPositionUniformLocation = gl.getUniformLocation(program, "uViewPosition");
    let useTextureUniformLocation = gl.getUniformLocation(program, "uUseTexture");
    
    let ambientColorUniformLocation = gl.getUniformLocation(program, "uAmbientColor");
    let diffuseColorUniformLocation = gl.getUniformLocation(program, "uDiffuseColor");
    let specularColorUniformLocation = gl.getUniformLocation(program, "uSpecularColor");
    let shininessUniformLocation = gl.getUniformLocation(program, "uShininess");    

    let cameraPos = vec3(2, 2, 2); // returns [x, y, z]
    let target = vec3(0, 0, 0);              // Orbiting around origin
    let up = vec3(0, 1, 0);

    // // === Light and Material Setup ===
    let lightPosition = vec3(parseFloat(document.getElementById("lightX").value), parseFloat(document.getElementById("lightY").value), parseFloat(document.getElementById("lightZ").value));
    let lightPosVec4 = vec4(lightPosition, 1.0);
    var viewMatrix =  lookAt(cameraPos, target, up); 
    let lightPosEyeVec4 = mult(viewMatrix, lightPosVec4);

    // Upload light values
    gl.uniform3fv(lightPositionUniformLocation, lightPosEyeVec4.slice(0,3));
    gl.uniform3fv(gl.getUniformLocation(program, "uAmbientColor"), [0.2, 0.2, 0.2]);
    gl.uniform3fv(gl.getUniformLocation(program, "uDiffuseColor"), [1.0, 1.0, 1.0]);
    gl.uniform3fv(gl.getUniformLocation(program, "uSpecularColor"), [1.0, 1.0, 1.0]);
    gl.uniform1f(gl.getUniformLocation(program, "uShininess"), 64.0);

    // Define transformation matrices
    var worldMatrix = mat4();
    var projMatrix = perspective(45, canvas.width / canvas.height, 0.1, 100.0);

    // Pass matrices to WebGL
    gl.uniformMatrix4fv(modelMatrixUniformLocation, gl.FALSE, flatten(worldMatrix));
    gl.uniformMatrix4fv(matViewUniformLocation, gl.FALSE, flatten(viewMatrix));
    gl.uniformMatrix4fv(matProjUniformLocation, gl.FALSE, flatten(projMatrix));

    // Set texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(textureUniformLocation, 0); 

    // Set the texture usage flag to false
    gl.uniform1i(useTextureUniformLocation, false);

    // Sphere Buffers
    const sphereVertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, sphereVertices, gl.STATIC_DRAW);

    const sphereNormalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereNormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, generateSphere(0.2, 32, 32).normals, gl.STATIC_DRAW);

    const sphereTexCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereTexCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, sphereUv, gl.STATIC_DRAW);

    const sphereIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sphereIndices, gl.STATIC_DRAW);

    // Centroid Buffers
    const centroidVertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, centroidVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, centroidVertices, gl.STATIC_DRAW);

    const centroidNormalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, centroidNormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, generateSphere(0.8, 32, 32).normals, gl.STATIC_DRAW);

    const centroidTexCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, centroidTexCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, centroidUv, gl.STATIC_DRAW);

    const centroidIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, centroidIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, centroidIndices, gl.STATIC_DRAW);
    
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    
    var loop = function () {
        // === Camera Setup ===
        let radAzimuth = azimuth * Math.PI / 180;
        let radElevation = elevation * Math.PI / 180;
    
        let cameraX = radius * Math.cos(radElevation) * Math.sin(radAzimuth);
        let cameraY = radius * Math.sin(radElevation);
        let cameraZ = radius * Math.cos(radElevation) * Math.cos(radAzimuth);
        let cameraPos = vec3(-cameraX, -cameraY, cameraZ);
    
        let viewMatrix = lookAt(cameraPos, vec3(0, 0, 0), vec3(0, 1, 0));
        let projMatrix = perspective(45, canvas.width / canvas.height, 0.1, 1000.0);
    
        gl.uniform3fv(viewPositionUniformLocation, flatten(cameraPos));
        gl.uniformMatrix4fv(matViewUniformLocation, false, flatten(viewMatrix));
        gl.uniformMatrix4fv(matProjUniformLocation, false, flatten(projMatrix));

        // === Light Setup ===
        gl.uniform1i(lightingEnabledUniformLocation, lightingEnabled ? 1 : 0);
        let lightWorldPos = vec3(parseFloat(document.getElementById("lightX").value), parseFloat(document.getElementById("lightY").value), parseFloat(document.getElementById("lightZ").value)); // Light in world space
        let lightWorldVec4 = vec4(lightWorldPos[0], lightWorldPos[1], lightWorldPos[2], 1.0);
        let lightEyeVec4 = mult(viewMatrix, lightWorldVec4); // Transform to eye space

        gl.uniform3fv(lightPositionUniformLocation, lightEyeVec4.slice(0, 3));

        gl.uniform3fv(ambientColorUniformLocation, [0.1, 0.1, 0.1]);
        gl.uniform3fv(diffuseColorUniformLocation, [1.0, 1.0, 1.0]);
        gl.uniform3fv(specularColorUniformLocation, [1.0, 1.0, 1.0]);
        gl.uniform1f(shininessUniformLocation, 100.0);
    
        // === Clear ===
        gl.enable(gl.DEPTH_TEST);
        gl.clearColor(0.05, 0.05, 0.08, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
        // === Grid / Axes / Arrows ===
        let identityMatrix = mat4();
        gl.uniformMatrix4fv(modelMatrixUniformLocation, false, flatten(identityMatrix));
    
        gl.bindBuffer(gl.ARRAY_BUFFER, gridBuffer);
        gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, false, 6 * 4, 0);
        gl.vertexAttribPointer(colorAttributeLocation, 3, gl.FLOAT, gl.FALSE, 6 * Float32Array.BYTES_PER_ELEMENT, 3 * Float32Array.BYTES_PER_ELEMENT);
        gl.enableVertexAttribArray(positionAttributeLocation);
        gl.drawArrays(gl.LINES, 0, gridVertices.length / 6);
    
        gl.bindBuffer(gl.ARRAY_BUFFER, axisBuffer);
        gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, false, 6 * 4, 0);
        gl.vertexAttribPointer(colorAttributeLocation, 3, gl.FLOAT, gl.FALSE, 6 * Float32Array.BYTES_PER_ELEMENT, 3 * Float32Array.BYTES_PER_ELEMENT);
        gl.drawArrays(gl.LINES, 0, axisVertices.length / 6);
    
        gl.bindBuffer(gl.ARRAY_BUFFER, arrowBuffer);
        gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, false, 6 * 4, 0);
        gl.vertexAttribPointer(colorAttributeLocation, 3, gl.FLOAT, gl.FALSE, 6 * Float32Array.BYTES_PER_ELEMENT, 3 * Float32Array.BYTES_PER_ELEMENT);
        gl.drawArrays(gl.TRIANGLES, 0, arrowVertices.length / 6);
    
        // === Draw Spheres ===
        dataPoints.forEach(point => {  
            let modelMatrix = mult(translate(point.x, point.y, point.z), scale(0.2, 0.2, 0.2));
            gl.uniformMatrix4fv(modelMatrixUniformLocation, false, flatten(modelMatrix)); // used in rendering
            gl.uniformMatrix4fv(modelMatrixUniformLocation, false, flatten(modelMatrix)); // used in lighting shader
    
            // Position
            gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexBuffer);
            gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(positionAttributeLocation);

            // Normals
            gl.bindBuffer(gl.ARRAY_BUFFER, sphereNormalBuffer);
            gl.vertexAttribPointer(normalAttributeLocation, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(normalAttributeLocation);

            // Texture Coords
            gl.bindBuffer(gl.ARRAY_BUFFER, sphereTexCoordBuffer);
            gl.vertexAttribPointer(texCoordAttributeLocation, 2, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(texCoordAttributeLocation);

            // Color 
            let sphereColors = [];
            for (let i = 0; i < sphereVertices.length / 3; i++) {
                sphereColors.push(point.r, point.g, point.b); 
            }

            let sphereColorBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, sphereColorBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sphereColors), gl.STATIC_DRAW);
            gl.vertexAttribPointer(colorAttributeLocation, 3, gl.FLOAT, gl.FALSE, 0, 0);
            gl.enableVertexAttribArray(colorAttributeLocation);

            // Bind texture
            gl.uniform1i(useTextureUniformLocation, textureEnabled);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.uniform1i(textureUniformLocation, 0);
    
            // Per-object material (if any unique per-point lighting wanted)
            gl.uniform3fv(diffuseColorUniformLocation, [point.r, point.g, point.b]);

            // Draw
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereIndexBuffer);
            gl.drawElements(gl.TRIANGLES, sphereIndices.length, gl.UNSIGNED_SHORT, 0);

            // gl.deleteBuffer(sphereColorBuffer);  // Cleanup after rendering
            gl.uniform1i(useTextureUniformLocation, false)
        });

        kMeans.centroids.forEach((point, index) => {
            let modelMatrix = mult(translate(point[0], point[1], point[2]), scale(0.2, 0.2, 0.2));
            gl.uniformMatrix4fv(modelMatrixUniformLocation, false, flatten(modelMatrix));
        
            // Disable texturing
            gl.uniform1i(useTextureUniformLocation, false);
        
            // Create flat color buffer
            let centroidColors = [];
            for (let i = 0; i < centroidVertices.length / 3; i++) {
                centroidColors.push(...kMeans.clusterColors[index]);
            }
            let centroidColorBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, centroidColorBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(centroidColors), gl.STATIC_DRAW);
            gl.vertexAttribPointer(colorAttributeLocation, 3, gl.FLOAT, gl.FALSE, 0, 0);
            gl.enableVertexAttribArray(colorAttributeLocation);

            // === Position ===
            gl.bindBuffer(gl.ARRAY_BUFFER, centroidVertexBuffer);
            gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(positionAttributeLocation);
        
            // === Normals ===
            gl.bindBuffer(gl.ARRAY_BUFFER, centroidNormalBuffer);
            gl.vertexAttribPointer(normalAttributeLocation, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(normalAttributeLocation);
        
            // === Texture Coordinates ===
            gl.bindBuffer(gl.ARRAY_BUFFER, centroidTexCoordBuffer);
            gl.vertexAttribPointer(texCoordAttributeLocation, 2, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(texCoordAttributeLocation);
        
            // === Lighting uniforms ===
            gl.uniform3fv(ambientColorUniformLocation, [0.1, 0.1, 0.1]);
            gl.uniform3fv(diffuseColorUniformLocation, kMeans.clusterColors[index]);
            gl.uniform3fv(specularColorUniformLocation, [1.0, 1.0, 1.0]);
            gl.uniform1f(shininessUniformLocation, 100.0);
        
            // === Draw ===
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, centroidIndexBuffer);
            gl.drawElements(gl.TRIANGLES, centroidIndices.length, gl.UNSIGNED_SHORT, 0);
        });        
    requestAnimationFrame(loop);
    }
    setData();
    kMeans.initialize(3);
    requestAnimationFrame(loop);

}

function generateSphere(radius, latBands, longBands) {
    let vertices = [];
    let normals = [];
    let textureCoordinates = [];
    let indices = [];

    for (let lat = 0; lat <= latBands; lat++) {
        let theta = lat * Math.PI / latBands;
        let sinTheta = Math.sin(theta);
        let cosTheta = Math.cos(theta);

        for (let lon = 0; lon <= longBands; lon++) {
            let phi = lon * 2 * Math.PI / longBands;
            let sinPhi = Math.sin(phi);
            let cosPhi = Math.cos(phi);

            // Vertex position
            let x = radius * sinTheta * cosPhi;
            let y = radius * cosTheta;
            let z = radius * sinTheta * sinPhi;
            vertices.push(x, y, z);

            // Normal (unit vector from center to point)
            let nx = sinTheta * cosPhi;
            let ny = cosTheta;
            let nz = sinTheta * sinPhi;
            normals.push(nx, ny, nz);

            // Texture coordinates
            let u = lon / longBands;
            let v = lat / latBands;
            textureCoordinates.push(u, v);
        }
    }

    for (let lat = 0; lat < latBands; lat++) {
        for (let lon = 0; lon < longBands; lon++) {
            let first = lat * (longBands + 1) + lon;
            let second = first + longBands + 1;

            indices.push(first, second, first + 1);
            indices.push(second, second + 1, first + 1);
        }
    }

    return {
        vertices: new Float32Array(vertices),
        normals: new Float32Array(normals),
        textureCoordinates: new Float32Array(textureCoordinates),
        indices: new Uint16Array(indices),
    };
}

function loadTexture(gl, url) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 255, 255])); 

    const image = new Image();
    image.onload = function() {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

        gl.generateMipmap(gl.TEXTURE_2D);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    };

    image.src = url;

    return texture;
}

function reset() {
    // Reset the dataset to default
    document.getElementById("data").value = "default";
    setData()

    // Reset the clustering method to K-Means
    document.getElementById("clusteringMethod").value = "kmeans";
    document.getElementById("kValue").value = 3;
    kMeans.initialize(3);

    // Reset lighting and texture toggles
    document.getElementById("toggleLighting").checked = true; 
    document.getElementById("toggleTexture").checked = true; 
    lightingEnabled = true; 
    textureEnabled = true;

    document.getElementById("upload").value = "";
}
