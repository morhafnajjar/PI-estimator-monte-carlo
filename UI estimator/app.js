// Monte Carlo π Estimation Simulator
class MonteCarloSimulator {
    constructor() {
        this.canvas = document.getElementById('simulationCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.isRunning = false;
        this.animationId = null;
        
        // UI elements
        this.runBtn = document.getElementById('runBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.pointsInput = document.getElementById('pointsInput');
        this.progressContainer = document.getElementById('progressContainer');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        
        // Result elements
        this.piEstimate = document.getElementById('piEstimate');
        this.pointsProcessed = document.getElementById('pointsProcessed');
        this.pointsInside = document.getElementById('pointsInside');
        this.executionTime = document.getElementById('executionTime');
        this.errorValue = document.getElementById('errorValue');
        this.accuracy = document.getElementById('accuracy');
        
        // Simulation data
        this.totalPoints = 0;
        this.pointsInsideCircle = 0;
        this.processedPoints = 0;
        this.startTime = 0;
        this.visualizationPoints = [];
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.bindEvents();
        this.drawInitialState();
        this.resetResults();
    }
    
    setupCanvas() {
        this.canvas.width = 400;
        this.canvas.height = 400;
        this.canvasSize = 400;
    }
    
    bindEvents() {
        this.runBtn.addEventListener('click', () => this.startSimulation());
        this.resetBtn.addEventListener('click', () => this.resetSimulation());
        
        // Fix input field issues
        this.pointsInput.addEventListener('focus', (e) => {
            e.target.select();
        });
        
        this.pointsInput.addEventListener('input', (e) => {
            let value = parseInt(e.target.value);
            if (isNaN(value) || value < 1000) {
                e.target.value = 1000;
            } else if (value > 10000000) {
                e.target.value = 10000000;
            }
        });
    }
    
    drawInitialState() {
        this.ctx.clearRect(0, 0, this.canvasSize, this.canvasSize);
        
        // Draw grid
        this.ctx.strokeStyle = '#e0e0e0';
        this.ctx.lineWidth = 1;
        for (let i = 0; i <= 10; i++) {
            const pos = (i / 10) * this.canvasSize;
            this.ctx.beginPath();
            this.ctx.moveTo(pos, 0);
            this.ctx.lineTo(pos, this.canvasSize);
            this.ctx.moveTo(0, pos);
            this.ctx.lineTo(this.canvasSize, pos);
            this.ctx.stroke();
        }
        
        // Draw quarter circle
        this.ctx.strokeStyle = '#21808D';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(0, this.canvasSize, this.canvasSize, 0, Math.PI / 2);
        this.ctx.stroke();
        
        // Draw unit square border
        this.ctx.strokeStyle = '#134252';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(0, 0, this.canvasSize, this.canvasSize);
        
        // Add labels
        this.ctx.fillStyle = '#134252';
        this.ctx.font = 'bold 14px Arial';
        this.ctx.fillText('(1,1)', this.canvasSize - 40, 20);
        this.ctx.fillText('(0,0)', 10, this.canvasSize - 10);
        this.ctx.fillText('Unit Circle', this.canvasSize / 2 - 40, this.canvasSize / 2 + 50);
    }
    
    getSimulationMode() {
        return document.querySelector('input[name="mode"]:checked').value;
    }
    
    async startSimulation() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.runBtn.textContent = 'Running...';
        this.runBtn.disabled = true;
        this.progressContainer.classList.remove('hidden');
        
        const totalPoints = parseInt(this.pointsInput.value) || 1000000;
        const mode = this.getSimulationMode();
        
        // Initialize simulation data
        this.totalPoints = totalPoints;
        this.pointsInsideCircle = 0;
        this.processedPoints = 0;
        this.startTime = performance.now();
        this.visualizationPoints = [];
        
        this.drawInitialState();
        
        try {
            if (mode === 'sequential') {
                await this.runSequentialSimulation(totalPoints);
            } else {
                await this.runParallelSimulation(totalPoints);
            }
        } catch (error) {
            console.error('Simulation error:', error);
        } finally {
            this.isRunning = false;
            this.runBtn.textContent = 'Run Simulation';
            this.runBtn.disabled = false;
            this.progressContainer.classList.add('hidden');
        }
    }
    
    async runSequentialSimulation(totalPoints) {
        const batchSize = Math.min(2000, Math.max(100, totalPoints / 200));
        const visualizationLimit = Math.min(5000, totalPoints);
        let visualizationSampleRate = visualizationLimit / totalPoints;
        
        for (let i = 0; i < totalPoints && this.isRunning; i += batchSize) {
            const currentBatch = Math.min(batchSize, totalPoints - i);
            
            // Process batch
            for (let j = 0; j < currentBatch; j++) {
                const x = Math.random();
                const y = Math.random();
                const isInside = (x * x + y * y) <= 1;
                
                if (isInside) {
                    this.pointsInsideCircle++;
                }
                
                // Add points for visualization
                if (this.visualizationPoints.length < visualizationLimit && Math.random() < visualizationSampleRate) {
                    this.visualizationPoints.push({ x, y, isInside });
                }
                
                this.processedPoints++;
            }
            
            // Update UI
            this.updateResults();
            this.updateVisualization();
            
            // Allow UI to breathe
            await this.sleep(5);
        }
    }
    
    async runParallelSimulation(totalPoints) {
        const numWorkers = Math.min(8, navigator.hardwareConcurrency || 4);
        const basePointsPerWorker = Math.floor(totalPoints / numWorkers);
        const visualizationLimit = Math.min(5000, totalPoints);
        
        // Simulate parallel execution with staggered timeouts
        const workerPromises = [];
        
        for (let i = 0; i < numWorkers; i++) {
            const workerPoints = i === numWorkers - 1 
                ? basePointsPerWorker + (totalPoints % numWorkers)
                : basePointsPerWorker;
            
            const delay = i * 10; // Stagger worker starts
            workerPromises.push(this.simulateWorker(workerPoints, delay, i === 0, visualizationLimit));
        }
        
        // Process workers with progress updates
        const results = await Promise.all(workerPromises);
        
        // Aggregate final results
        this.pointsInsideCircle = results.reduce((sum, result) => sum + result.pointsInside, 0);
        this.processedPoints = results.reduce((sum, result) => sum + result.pointsProcessed, 0);
        
        // Collect visualization points from first worker
        results.forEach(result => {
            if (result.visualizationPoints.length > 0) {
                this.visualizationPoints.push(...result.visualizationPoints);
            }
        });
        
        this.updateResults();
        this.updateVisualization();
    }
    
    async simulateWorker(points, delay, shouldVisualize, visualizationLimit) {
        await this.sleep(delay);
        
        const result = {
            pointsInside: 0,
            pointsProcessed: 0,
            visualizationPoints: []
        };
        
        const batchSize = Math.min(1000, points / 10);
        const visualizationSampleRate = shouldVisualize ? (visualizationLimit / points) : 0;
        
        for (let i = 0; i < points && this.isRunning; i += batchSize) {
            const currentBatch = Math.min(batchSize, points - i);
            
            for (let j = 0; j < currentBatch; j++) {
                const x = Math.random();
                const y = Math.random();
                const isInside = (x * x + y * y) <= 1;
                
                if (isInside) {
                    result.pointsInside++;
                }
                
                if (shouldVisualize && result.visualizationPoints.length < visualizationLimit / 2 && Math.random() < visualizationSampleRate) {
                    result.visualizationPoints.push({ x, y, isInside });
                }
                
                result.pointsProcessed++;
            }
            
            // Update global progress for parallel mode
            this.pointsInsideCircle += result.pointsInside;
            this.processedPoints += result.pointsProcessed;
            
            if (shouldVisualize) {
                this.visualizationPoints.push(...result.visualizationPoints);
                this.updateResults();
                this.updateVisualization();
            }
            
            // Reset for next batch
            result.pointsInside = 0;
            result.pointsProcessed = 0;
            result.visualizationPoints = [];
            
            await this.sleep(2);
        }
        
        return result;
    }
    
    updateResults() {
        const currentTime = performance.now();
        const elapsedTime = currentTime - this.startTime;
        
        // Calculate π estimate
        const piEst = this.processedPoints > 0 ? (4 * this.pointsInsideCircle) / this.processedPoints : 0;
        const actualPi = Math.PI;
        const error = Math.abs(piEst - actualPi);
        const accuracy = this.processedPoints > 0 ? Math.max(0, 100 - ((error / actualPi) * 100)) : 0;
        
        // Update progress
        const progress = Math.min(100, (this.processedPoints / this.totalPoints) * 100);
        this.progressFill.style.width = `${progress}%`;
        this.progressText.textContent = `${Math.round(progress)}%`;
        
        // Update result displays
        this.piEstimate.textContent = piEst.toFixed(6);
        this.pointsProcessed.textContent = this.processedPoints.toLocaleString();
        this.pointsInside.textContent = this.pointsInsideCircle.toLocaleString();
        this.executionTime.textContent = `${Math.round(elapsedTime)}ms`;
        this.errorValue.textContent = error.toFixed(6);
        this.accuracy.textContent = `${accuracy.toFixed(2)}%`;
        
        // Highlight good results
        const piCard = this.piEstimate.parentElement;
        if (accuracy > 99) {
            piCard.classList.add('result-card--highlight');
        } else {
            piCard.classList.remove('result-card--highlight');
        }
    }
    
    updateVisualization() {
        // Redraw initial state
        this.drawInitialState();
        
        // Draw sampled points
        this.visualizationPoints.forEach(point => {
            const canvasX = point.x * this.canvasSize;
            const canvasY = this.canvasSize - (point.y * this.canvasSize);
            
            this.ctx.fillStyle = point.isInside ? '#1FB8CD' : '#B4413C';
            this.ctx.beginPath();
            this.ctx.arc(canvasX, canvasY, 1.5, 0, 2 * Math.PI);
            this.ctx.fill();
        });
        
        // Redraw circle and square outline
        this.ctx.strokeStyle = '#21808D';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(0, this.canvasSize, this.canvasSize, 0, Math.PI / 2);
        this.ctx.stroke();
        
        this.ctx.strokeStyle = '#134252';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(0, 0, this.canvasSize, this.canvasSize);
    }
    
    resetResults() {
        this.piEstimate.textContent = '-';
        this.pointsProcessed.textContent = '0';
        this.pointsInside.textContent = '0';
        this.executionTime.textContent = '0ms';
        this.errorValue.textContent = '-';
        this.accuracy.textContent = '-';
        
        this.progressFill.style.width = '0%';
        this.progressText.textContent = '0%';
    }
    
    resetSimulation() {
        this.isRunning = false;
        
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        // Reset data
        this.totalPoints = 0;
        this.pointsInsideCircle = 0;
        this.processedPoints = 0;
        this.visualizationPoints = [];
        
        // Reset UI
        this.runBtn.textContent = 'Run Simulation';
        this.runBtn.disabled = false;
        this.progressContainer.classList.add('hidden');
        
        // Reset results
        this.resetResults();
        
        // Remove highlights
        document.querySelectorAll('.result-card--highlight').forEach(card => {
            card.classList.remove('result-card--highlight');
        });
        
        // Redraw canvas
        this.drawInitialState();
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize the simulator when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const simulator = new MonteCarloSimulator();
    
    // Add some educational logging
    console.log('Monte Carlo π Estimation Simulator initialized');
    console.log('The Monte Carlo method uses random sampling to estimate π');
    console.log('Formula: π ≈ 4 × (points inside circle) / (total points)');
    console.log('Try both Sequential and Parallel modes to compare performance!');
});