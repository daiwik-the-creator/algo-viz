
// let dataPoints = [
//     { x: 1.0, y: 1.0, z: 1.0, r: 1, g: 0, b: 0 },
//     { x: 1.1, y: 0.9, z: 1.2, r: 1, g: 0, b: 0 },
let dataPoints = [];

function generateCluster(center, size, noise = 1.1) {
    const cluster = [];
    for (let i = 0; i < size; i++) {
        cluster.push({
            x: center.x + (Math.random() - 0.5) * noise,
            y: center.y + (Math.random() - 0.5) * noise,
            z: center.z + (Math.random() - 0.5) * noise,
            r: 1, // White color
            g: 1, // White color
            b: 1, // White color
        });
    }
    return cluster;
}

function makeSwissRoll(n_samples = 1000, noise = 0.0, layers = 3, hole = false) {
    const dataPoints = [];
    const rng = Math.random; // Simple random generator

    let t = new Array(n_samples);
    let y = new Array(n_samples);

    if (!hole) {
        for (let i = 0; i < n_samples; i++) {
            t[i] = (1.5 + 2 * rng()) * Math.PI; // Spiral control

            // Divide height (y) into multiple layers
            let layerIndex = Math.floor(rng() * layers);
            let baseHeight = (layerIndex / (layers - 1)) * 21;

            y[i] = baseHeight + (rng() - 0.5) * (21 / layers); // Small variation
        }
    } else {
        const corners = [
            [1.5 * Math.PI, 0], [1.5 * Math.PI, 7], [1.5 * Math.PI, 14],
            [2.5 * Math.PI, 0], /* Hole removed */  [2.5 * Math.PI, 14],
            [3.5 * Math.PI, 0], [3.5 * Math.PI, 7], [3.5 * Math.PI, 14]
        ];
        for (let i = 0; i < n_samples; i++) {
            const corner = corners[Math.floor(rng() * 8)];
            t[i] = corner[0] + rng() * Math.PI;
            let layerIndex = Math.floor(rng() * layers);
            let baseHeight = (layerIndex / (layers - 1)) * 21;
            y[i] = baseHeight + (rng() - 0.5) * (21 / layers);
        }
    }

    // Compute x, z using t
    let x = t.map(val => val * Math.cos(val));
    let z = t.map(val => val * Math.sin(val));

    // Add Gaussian noise
    if (noise > 0) {
        x = x.map(val => val + (rng() - 0.5) * noise);
        y = y.map(val => val + (rng() - 0.5) * noise);
        z = z.map(val => val + (rng() - 0.5) * noise);
    }

    // Find min/max for normalization
    const minMax = arr => [Math.min(...arr), Math.max(...arr)];
    const [x_min, x_max] = minMax(x);
    const [y_min, y_max] = minMax(y);
    const [z_min, z_max] = minMax(z);

    // Normalize to [-2, 2]
    const normalize = (val, min, max) => ((val - min) / (max - min)) * 4 - 2;

    // Generate final data points
    for (let i = 0; i < n_samples; i++) {
        dataPoints.push({
            x: normalize(x[i], x_min, x_max),
            y: normalize(y[i], y_min, y_max),
            z: normalize(z[i], z_min, z_max),
            r: Math.abs(Math.sin(t[i] / Math.PI)), // Color based on t
            g: Math.abs(Math.cos(t[i] / Math.PI)),
            b: 1 - (Math.abs(Math.sin(t[i] / Math.PI)) + Math.abs(Math.cos(t[i] / Math.PI))) / 2
        });
    }

    return dataPoints;
}

dataPoints = [
    ...generateCluster({ x: 1.0, y: 1.0, z: 1.0 }, 100), // Cluster 1
    ...generateCluster({ x: -1.0, y: -1.0, z: -1.0 }, 100), // Cluster 2
    ...generateCluster({ x: 0.5, y: -0.5, z: 0.5 }, 100), // Cluster 3
];



async function loadCSV(filePath, rowLimit = Infinity) {
    const response = await fetch(filePath);
    const csvText = await response.text();

    return new Promise((resolve) => {
        Papa.parse(csvText, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: function (results) {
                let rawData = results.data.slice(0, rowLimit);

                // Find min and max values for normalization
                const minX = Math.min(...rawData.map(row => row.x_coordinate));
                const maxX = Math.max(...rawData.map(row => row.x_coordinate));
                const minY = Math.min(...rawData.map(row => row.y_coordinate));
                const maxY = Math.max(...rawData.map(row => row.y_coordinate));
                const minZ = Math.min(...rawData.map(row => row.z_coordinate));
                const maxZ = Math.max(...rawData.map(row => row.z_coordinate));

                // Normalize function
                const normalize = (value, min, max) => ((value - min) / (max - min)) * 2 - 1;

                // Normalize and store data
                dataPoints.push(...rawData.map(row => ({
                    x: normalize(row.x_coordinate, minX, maxX),
                    y: normalize(row.y_coordinate, minY, maxY),
                    z: normalize(row.z_coordinate, minZ, maxZ),
                    r: 1, g: 1, b: 1 // Default color (white)
                })));

                resolve(dataPoints);
            }
        });
    });
}

// Example usage: Load only the first 10 rows with normalization
// loadCSV('dataset.csv', 500).then(() => {
//     console.log("Final Normalized Data Points:", dataPoints);
// });

// dataPoints = makeSwissRoll(1000, 0.5);

var vertexShaderSource = `
    precision mediump float;

    attribute vec3 vertPosition;
    attribute vec3 vertColor;

    varying vec3 fragColor;

    uniform mat4 mWorld;
    uniform mat4 mView;
    uniform mat4 mProj;

    void main()
    {
        fragColor = vertColor;
        gl_PointSize = 8.0;
        gl_Position = mProj * mView * mWorld * vec4(vertPosition, 1.0);
    }
`;

var fragmentShaderSource = `
    precision mediump float;

    varying vec3 fragColor;

    void main()
    {
        gl_FragColor = vec4(fragColor, 1.0);
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

const { vertices: sphereVertices, indices: sphereIndices } = generateSphere(0.2, 16, 16);
const { vertices: centroidVertices, indices: centroidIndices } = generateSphere(0.8, 16, 16);

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

    var positionAttributeLocation = gl.getAttribLocation(program, 'vertPosition');
    var colorAttributeLocation = gl.getAttribLocation(program, 'vertColor');

    // Tell OpenGL state machine which program should be active. 
    gl.useProgram(program);

    // Get uniform locations
    var matWorldUniformLocation = gl.getUniformLocation(program, 'mWorld');
    var matViewUniformLocation = gl.getUniformLocation(program, 'mView');
    var matProjUniformLocation = gl.getUniformLocation(program, 'mProj');

    // Define transformation matrices
    var worldMatrix = mat4();  // Identity matrix by default
    var viewMatrix = lookAt(vec3(0, 0, -6), vec3(0, 0, 0), vec3(0, 1, 0));  // LookAt function in MV.js
    var projMatrix = perspective(45, canvas.width / canvas.height, 0.1, 1000.0);  // Perspective matrix in MV.js

    // Pass matrices to WebGL
    gl.uniformMatrix4fv(matWorldUniformLocation, gl.FALSE, flatten(worldMatrix));
    gl.uniformMatrix4fv(matViewUniformLocation, gl.FALSE, flatten(viewMatrix));
    gl.uniformMatrix4fv(matProjUniformLocation, gl.FALSE, flatten(projMatrix));

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

    // Render spheres for each data point
    dataPoints.forEach((point, index) => {
        // Apply transformations (worldMatrix affects all objects)
        let localModelMatrix = mult(translate(point.x, point.y, point.z), scale(0.2, 0.2, 0.2));
        let finalModelMatrix = mult(worldMatrix, localModelMatrix);

        gl.uniformMatrix4fv(matWorldUniformLocation, gl.FALSE, flatten(finalModelMatrix));

        // Bind sphere buffer and set position attribute
        gl.bindBuffer(gl.ARRAY_BUFFER, sphereBuffer);
        gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, gl.FALSE, 6 * Float32Array.BYTES_PER_ELEMENT, 0);
        gl.enableVertexAttribArray(positionAttributeLocation);

        // Create and Bind Color Buffer (Fixing Color Assignment)
        const sphereColors = [];
        for (let i = 0; i < sphereVertices.length / 3; i++) {
            sphereColors.push(point.r, point.g, point.b); // Assign color for each vertex
        }

        const sphereColorBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, sphereColorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sphereColors), gl.STATIC_DRAW);

        gl.vertexAttribPointer(colorAttributeLocation, 3, gl.FLOAT, gl.FALSE, 0, 0);
        gl.enableVertexAttribArray(colorAttributeLocation);

        // Bind element buffer and draw
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereIndexBuffer);
        gl.drawElements(gl.TRIANGLES, sphereIndices.length, gl.UNSIGNED_SHORT, 0);

        // Cleanup color buffer to prevent memory leaks
        gl.deleteBuffer(sphereColorBuffer);
    });

    kMeans.centroids.forEach((point, index) => {
        console.log("s");
        // Apply transformations (worldMatrix affects all objects)
        let localModelMatrix = mult(translate(point.x, point.y, point.z), scale(0.2, 0.2, 0.2));
        let finalModelMatrix = mult(worldMatrix, localModelMatrix);

        gl.uniformMatrix4fv(matWorldUniformLocation, gl.FALSE, flatten(finalModelMatrix));

        // Bind centroid buffer and set position attribute
        gl.bindBuffer(gl.ARRAY_BUFFER, centroidBuffer);
        gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, gl.FALSE, 6 * Float32Array.BYTES_PER_ELEMENT, 0);
        gl.enableVertexAttribArray(positionAttributeLocation);

        // Create and Bind Color Buffer (Fixing Color Assignment)
        const centroidColors = [];
        for (let i = 0; i < centroidVertices.length / 3; i++) {
            centroidColors.push(point.r, point.g, point.b); // Assign color for each vertex
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
    
    var xRotationMatrix = mat4();  // Identity matrix by default
    var yRotationMatrix = mat4();  // Identity matrix by default    

    // Main Render Loop
    var angle = 0;
    var loop = function() {
  
        // angle = performance.now() / 1000 / 6 * 2 * Math.PI;

        // Get shear values
        let shearX = parseFloat(document.getElementById("shearX").value);
        let shearY = parseFloat(document.getElementById("shearY").value);
        let shearZ = parseFloat(document.getElementById("shearZ").value);

        // Create shear matrix
        let shearMatrix = shear(shearX, shearY, shearZ);

        // ROTATION matrix
        xRotationMatrix = rotateX(document.getElementById("rotateX").value);
        yRotationMatrix = rotateY(document.getElementById("rotateY").value); 
        zRotationMatrix = rotateZ(document.getElementById("rotateZ").value);

        // TRANSLATION matrix
        let tx = parseFloat(document.getElementById("translateX").value);
        let ty = parseFloat(document.getElementById("translateY").value);
        let tz = parseFloat(document.getElementById("translateZ").value);
        let translationMatrix = translate(tx, ty, tz);

        // SCALE matrix
        let sx = parseFloat(document.getElementById("scaleX").value);
        let sy = parseFloat(document.getElementById("scaleY").value);
        let sz = parseFloat(document.getElementById("scaleZ").value);
        let scaleMatrix = scale(sx, sy, sz);

        // Set the reflection matrix
        reflectionMatrix = getReflectionMatrix();

        worldMatrix = mult(translationMatrix, mult(reflectionMatrix, mult(shearMatrix, mult(yRotationMatrix, mult(xRotationMatrix, mult(zRotationMatrix, scaleMatrix))))));

        // Upload the transformation matrix
        gl.uniformMatrix4fv(matWorldUniformLocation, gl.FALSE, flatten(worldMatrix));
            
        // Set background color
        gl.clearColor(30 / 255, 30 / 255, 30 / 255, 1.0);
        gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);
            
        // Draw Grid
        gl.bindBuffer(gl.ARRAY_BUFFER, gridBuffer);
        gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, gl.FALSE, 6 * Float32Array.BYTES_PER_ELEMENT, 0);
        gl.vertexAttribPointer(colorAttributeLocation, 3, gl.FLOAT, gl.FALSE, 6 * Float32Array.BYTES_PER_ELEMENT, 3 * Float32Array.BYTES_PER_ELEMENT);
        gl.enableVertexAttribArray(positionAttributeLocation);
        gl.enableVertexAttribArray(colorAttributeLocation);
        gl.drawArrays(gl.LINES, 0, gridVertices.length / 6);
            
        // Draw Axes
        gl.bindBuffer(gl.ARRAY_BUFFER, axisBuffer);
        gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, gl.FALSE, 6 * Float32Array.BYTES_PER_ELEMENT, 0);
        gl.vertexAttribPointer(colorAttributeLocation, 3, gl.FLOAT, gl.FALSE, 6 * Float32Array.BYTES_PER_ELEMENT, 3 * Float32Array.BYTES_PER_ELEMENT);
        gl.drawArrays(gl.LINES, 0, axisVertices.length / 6);

        // Draw Arrowheads
        gl.bindBuffer(gl.ARRAY_BUFFER, arrowBuffer);
        gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, gl.FALSE, 6 * Float32Array.BYTES_PER_ELEMENT, 0);
        gl.vertexAttribPointer(colorAttributeLocation, 3, gl.FLOAT, gl.FALSE, 6 * Float32Array.BYTES_PER_ELEMENT, 3 * Float32Array.BYTES_PER_ELEMENT);
        gl.drawArrays(gl.TRIANGLES, 0, arrowVertices.length / 6);

         // 🌟 Draw Spheres (Data Points)
         dataPoints.forEach(point => {
            // Apply global transformations (worldMatrix) to the sphere's local transformation
            let localModelMatrix = mult(translate(point.x, point.y, point.z), scale(0.2, 0.2, 0.2));
            let finalModelMatrix = mult(worldMatrix, localModelMatrix); // Apply worldMatrix
        
            gl.uniformMatrix4fv(matWorldUniformLocation, gl.FALSE, flatten(finalModelMatrix));
        
            // Create color buffer for this sphere
            let sphereColors = [];
            for (let i = 0; i < sphereVertices.length / 3; i++) {
                sphereColors.push(point.r, point.g, point.b); // Assign the dataset color to each vertex
            }
        
            // Create and bind color buffer
            let sphereColorBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, sphereColorBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sphereColors), gl.STATIC_DRAW);
        
            gl.bindBuffer(gl.ARRAY_BUFFER, sphereBuffer);
            gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, gl.FALSE, 6 * Float32Array.BYTES_PER_ELEMENT, 0);
            gl.enableVertexAttribArray(positionAttributeLocation);
        
            gl.bindBuffer(gl.ARRAY_BUFFER, sphereColorBuffer);
            gl.vertexAttribPointer(colorAttributeLocation, 3, gl.FLOAT, gl.FALSE, 0, 0);
            gl.enableVertexAttribArray(colorAttributeLocation);
        
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereIndexBuffer);
            gl.drawElements(gl.TRIANGLES, sphereIndices.length, gl.UNSIGNED_SHORT, 0);
        
            gl.deleteBuffer(sphereColorBuffer); // Cleanup color buffer to avoid memory leaks
        });

        if (kMeans.centroids.length > 0) {

            kMeans.centroids.forEach((point, index) => {

                // Apply transformations (worldMatrix affects all objects)
                let localModelMatrix = mult(translate(point[0], point[1], point[2]), scale(0.2, 0.2, 0.2));
                let finalModelMatrix = mult(worldMatrix, localModelMatrix);
        
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
        }

        requestAnimationFrame(loop);
    }

    kMeans.initialize();
    requestAnimationFrame(loop);
};

function generateSphere(radius, latBands, longBands) {
    let vertices = [];
    let indices = [];

    for (let lat = 0; lat <= latBands; lat++) {
        let theta = (lat * Math.PI) / latBands;
        let sinTheta = Math.sin(theta);
        let cosTheta = Math.cos(theta);

        for (let long = 0; long <= longBands; long++) {
            let phi = (long * 2 * Math.PI) / longBands;
            let sinPhi = Math.sin(phi);
            let cosPhi = Math.cos(phi);

            let x = cosPhi * sinTheta;
            let y = cosTheta;
            let z = sinPhi * sinTheta;

            vertices.push(radius * x, radius * y, radius * z, 1, 1, 1); // White color (or modify)
        }
    }

    for (let lat = 0; lat < latBands; lat++) {
        for (let long = 0; long < longBands; long++) {
            let first = (lat * (longBands + 1)) + long;
            let second = first + longBands + 1;
            indices.push(first, second, first + 1);
            indices.push(second, second + 1, first + 1);
        }
    }

    return { vertices, indices };
}

function reset() {
    transformOrder = "scaleThenRotate";
    document.getElementById("translateX").value = 0;
    document.getElementById("translateY").value = 0;
    document.getElementById("translateZ").value = 0;
    document.getElementById("rotateX").value = 0;
    document.getElementById("rotateY").value = 0;
    document.getElementById("rotateZ").value = 0;
    document.getElementById("scaleX").value = 1;
    document.getElementById("scaleY").value = 1;
    document.getElementById("scaleZ").value = 1;
    document.getElementById("reflectX").checked = false;
    document.getElementById("reflectY").checked = false;
    document.getElementById("reflectZ").checked = false;
    document.getElementById("shearX").value = 0;
    document.getElementById("shearY").value = 0;
    document.getElementById("shearZ").value = 0;
}

function reflectX() {
    return mat4(
        -1,  0,  0,  0,
         0,  1,  0,  0,
         0,  0,  1,  0,
         0,  0,  0,  1
    );
}

function reflectY() {
    return mat4(
         1,  0,  0,  0,
         0, -1,  0,  0,
         0,  0,  1,  0,
         0,  0,  0,  1
    );
}

function reflectZ() {
    return mat4(
         1,  0,  0,  0,
         0,  1,  0,  0,
         0,  0, -1,  0,
         0,  0,  0,  1
    );
}

function getReflectionMatrix() {
    let reflectionMatrix = mat4(); // Start with an identity matrix

    // Check if each reflection checkbox is selected, and apply the corresponding reflection
    if (document.getElementById("reflectX").checked) {
        reflectionMatrix = mult(reflectionMatrix, reflectX());
    }
    if (document.getElementById("reflectY").checked) {
        reflectionMatrix = mult(reflectionMatrix, reflectY());
    }
    if (document.getElementById("reflectZ").checked) {
        reflectionMatrix = mult(reflectionMatrix, reflectZ());
    }

    return reflectionMatrix;
}

function shear(xShear, yShear, zShear) {
    return mat4(
        1, xShear, yShear, 0, 
        0, 1, zShear, 0,      
        0, 0, 1, 0,           
        0, 0, 0, 1            
    );
}

function randomPoints(count, range = 10) {
    const points = [];
    for (let i = 0; i < count; i++) {
        const p = {
            x: Math.random() * range - range / 2,
            y: Math.random() * range - range / 2,
            z: Math.random() * range - range / 2
        };
        points.push([p.x, p.y, p.z]);
    }
    return points;
}

// ===================================
// K-MEANS CLUSTERING IMPLEMENTATION
// ===================================
let kMeans = {
    k: 3,
    centroids: [],
    clusters: [],
    clusterColors: [],
    iteration: 0,

    initialize() {
        this.centroids = randomPoints(this.k);//dataPoints.slice(0, this.k).map(p => [p.x, p.y, p.z]); // Select initial centroids
        this.clusters = new Array(dataPoints.length).fill(-1);
        this.clusterColors = generateClusterColors(this.k);
        this.iteration = 0;
        updateVisualization("K-Means Initialized");
    },

    nextStep() {
        if (this.iteration === 0) {
            console.log("Step 1: Initializing centroids...");
        } else {
            console.log(`Step ${this.iteration + 1}: Assigning points and updating centroids...`);
        }

        let clusterChanged = false;

        // Step 2: Assign points to nearest centroid
        for (let i = 0; i < dataPoints.length; i++) {
            let minDist = Infinity, clusterIndex = -1;
            for (let j = 0; j < this.k; j++) {
                let dist = euclideanDistance([dataPoints[i].x, dataPoints[i].y, dataPoints[i].z], this.centroids[j]);
                if (dist < minDist) {
                    minDist = dist;
                    clusterIndex = j;
                }
            }
            if (this.clusters[i] !== clusterIndex) {
                this.clusters[i] = clusterIndex;
                clusterChanged = true;
            }
        }

        // Step 3: Recalculate centroids
        let newCentroids = Array.from({ length: this.k }, () => [0, 0, 0]);
        let counts = Array(this.k).fill(0);

        for (let i = 0; i < dataPoints.length; i++) {
            let cluster = this.clusters[i];
            if (cluster === -1) continue;

            newCentroids[cluster][0] += dataPoints[i].x;
            newCentroids[cluster][1] += dataPoints[i].y;
            newCentroids[cluster][2] += dataPoints[i].z;
            counts[cluster]++;
        }

        for (let j = 0; j < this.k; j++) {
            if (counts[j] > 0) {
                newCentroids[j] = newCentroids[j].map(val => val / counts[j]);
            } else {
                newCentroids[j] = [Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1];
            }
        }

        this.centroids = newCentroids;
        this.iteration++;

        // Step 4: Assign colors
        for (let i = 0; i < dataPoints.length; i++) {
            let cluster = this.clusters[i];
            if (cluster === -1) continue;
            dataPoints[i].r = this.clusterColors[cluster][0];
            dataPoints[i].g = this.clusterColors[cluster][1];
            dataPoints[i].b = this.clusterColors[cluster][2];
        }

        updateVisualization(`K-Means Iteration ${this.iteration}`);

        if (!clusterChanged) {
            console.log("K-means has converged!");
        }
    }
};

// ===================================
// DBSCAN CLUSTERING IMPLEMENTATION
// ===================================
let dbscan = {
    eps: 0.5,
    minPts: 5,
    clusters: [],
    noise: [],
    visited: new Set(),
    clusterColors: [],
    currentPoint: 0,
    clusterIndex: 0,

    initialize() {
        kMeans.centroids = [];
        this.clusters = [];
        this.noise = [];
        this.visited.clear();
        this.currentPoint = 0;
        this.clusterIndex = 0;
        this.clusterColors = generateClusterColors(dataPoints.length);

        updateVisualization("DBSCAN Initialized");
        console.log("DBSCAN initialized. Call `dbscan.nextStep()` to start.");
    },

    nextStep() {
        if (this.currentPoint >= dataPoints.length) {
            console.log("DBSCAN clustering complete.");
            return;
        }

        if (this.visited.has(this.currentPoint)) {
            this.currentPoint++;
            this.nextStep(); // Skip visited points
            return;
        }

        this.visited.add(this.currentPoint);
        let neighbors = regionQuery(this.currentPoint, this.eps);

        if (neighbors.length < this.minPts) {
            this.noise.push(this.currentPoint);
        } else {
            this.clusters.push([]);
            this.expandCluster(this.currentPoint, neighbors, this.clusterIndex);
            this.clusterIndex++;
        }

        this.currentPoint++;
        assignDBSCANClusterColors();
        updateVisualization(`DBSCAN Processing Point ${this.currentPoint}`);
    },

    expandCluster(pointIndex, neighbors, clusterIndex) {
        this.clusters[clusterIndex].push(pointIndex);

        for (let i = 0; i < neighbors.length; i++) {
            let neighborIndex = neighbors[i];

            if (!this.visited.has(neighborIndex)) {
                this.visited.add(neighborIndex);
                let newNeighbors = regionQuery(neighborIndex, this.eps);

                if (newNeighbors.length >= this.minPts) {
                    neighbors.push(...newNeighbors);
                }
            }

            if (!isPointInAnyCluster(neighborIndex)) {
                this.clusters[clusterIndex].push(neighborIndex);
            }
        }
    }
};

// ===================================
// UTILITIES
// ===================================
function regionQuery(pointIndex, eps) {
    let neighbors = [];
    for (let j = 0; j < dataPoints.length; j++) {
        if (pointIndex !== j) {
            let dist = euclideanDistance(
                [dataPoints[pointIndex].x, dataPoints[pointIndex].y, dataPoints[pointIndex].z],
                [dataPoints[j].x, dataPoints[j].y, dataPoints[j].z]
            );
            if (dist <= eps) {
                neighbors.push(j);
            }
        }
    }
    return neighbors;
}

function isPointInAnyCluster(pointIndex) {
    return dbscan.clusters.some(cluster => cluster.includes(pointIndex));
}

function assignDBSCANClusterColors() {
    for (let i = 0; i < dbscan.clusters.length; i++) {
        let color = dbscan.clusterColors[i];
        for (let j of dbscan.clusters[i]) {
            dataPoints[j].r = color[0];
            dataPoints[j].g = color[1];
            dataPoints[j].b = color[2];
        }
    }

    for (let j of dbscan.noise) {
        dataPoints[j].r = 0;
        dataPoints[j].g = 0;
        dataPoints[j].b = 0;
    }
}

function euclideanDistance(pointA, pointB) {
    return Math.sqrt(pointA.reduce((sum, val, idx) => sum + (val - pointB[idx]) ** 2, 0));
}

function generateClusterColors(k) {
    return Array.from({ length: k }, () => [Math.random(), Math.random(), Math.random()]);
}

function updateVisualization(message) {
    console.log(message);
    console.log("Data Points:", dataPoints);
}
