// ===================================
// K-MEANS CLUSTERING IMPLEMENTATION
// ===================================
let kMeans = {
    k: 0,
    centroids: [],
    clusters: [],
    clusterColors: [],
    iteration: 0,

    initialize(k) {
        this.k = k;
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