let dataPoints = [];

function setData() {
    let type = document.getElementById("data").value;
    console.log(type);
    if (type == "swissroll") {
        dataPoints = makeSwissRoll(1000, 0.5);
    } else if (type == "noise") {
        dataPoints = []
        loadCSV('dataset.csv', 500).then(() => {
            console.log("Final Normalized Data Points:", dataPoints);
        });
    } else {
        dataPoints = [
            ...generateCluster({ x: 1.0, y: 1.0, z: 1.0 }, 100), // Cluster 1
            ...generateCluster({ x: -1.0, y: -1.0, z: -1.0 }, 100), // Cluster 2
            ...generateCluster({ x: 0.5, y: -0.5, z: 0.5 }, 100), // Cluster 3
        ];     
    }
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

// Handle user-uploaded CSV file with [X, Y, Z] format, no headers
function handleUploadedCSV(file, maxPoints = 500) {
    Papa.parse(file, {
      complete: function(results) {
        const rawData = results.data;
  
        const cleanedData = rawData
          .filter(row => row.length >= 3 && !isNaN(row[0]) && !isNaN(row[1]) && !isNaN(row[2]))
          .slice(0, maxPoints); // Limit to maxPoints
  
        // Find min and max for each axis
        const getMinMax = (index) => {
          const values = cleanedData.map(row => parseFloat(row[index]));
          return [Math.min(...values), Math.max(...values)];
        };
  
        const [minX, maxX] = getMinMax(0);
        const [minY, maxY] = getMinMax(1);
        const [minZ, maxZ] = getMinMax(2);
  
        const normalize = (value, min, max) => ((value - min) / (max - min)) * 2 - 1;
  
        dataPoints = cleanedData.map(row => ({
          x: normalize(parseFloat(row[0]), minX, maxX),
          y: normalize(parseFloat(row[1]), minY, maxY),
          z: normalize(parseFloat(row[2]), minZ, maxZ),
          r: 1, g: 1, b: 1
        }));
  
        updateVisualization("User dataset loaded");
      }
    });
  }