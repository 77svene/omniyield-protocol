class JobQueue {
  constructor() {
    this.jobs = [];
  }

  enqueue(task, priority) {
    if (typeof task !== 'function') {
      throw new Error('JobQueue.enqueue: task must be a function');
    }
    if (typeof priority !== 'number' || !isFinite(priority)) {
      throw new Error('JobQueue.enqueue: priority must be a finite number');
    }
    // Insert job in sorted order (ascending priority: lower number = higher priority)
    let inserted = false;
    for (let i = 0; i < this.jobs.length; i++) {
      if (priority < this.jobs[i].priority) {
        this.jobs.splice(i, 0, { task, priority });
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      this.jobs.push({ task, priority });
    }
  }

  dequeue() {
    if (this.jobs.length === 0) {
      return null;
    }
    const job = this.jobs.shift();
    try {
      return job.task();
    } catch (error) {
      console.error(`JobQueue.dequeue: Task execution failed: ${error.message}`);
      throw error;
    }
  }

  size() {
    return this.jobs.length;
  }
}

module.exports = JobQueue;