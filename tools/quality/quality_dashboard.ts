#!/usr/bin/env node

/**
 * Code Quality Dashboard
 * Tracks and visualizes code quality metrics for the Vibes application
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface QualityMetrics {
  timestamp: string;
  eslintErrors: number;
  eslintWarnings: number;
  deadCodeCount: number;
  unusedImports: number;
  testCoverage: number;
  complexityScore: number;
  maintainabilityIndex: number;
  technicalDebtRatio: number;
}

interface QualityReport {
  reportId: string;
  generatedAt: string;
  summary: QualityMetrics;
  trends: {
    eslintTrend: number;
    deadCodeTrend: number;
    coverageTrend: number;
    maintainabilityTrend: number;
  };
  recommendations: string[];
  passedGates: string[];
  failedGates: string[];
}

class QualityDashboard {
  private reportsDir: string;
  private qualityThresholds = {
    maxEslintErrors: 0,
    maxEslintWarnings: 10,
    maxDeadCode: 5,
    maxUnusedImports: 3,
    minTestCoverage: 85,
    maxComplexity: 10,
    minMaintainability: 80,
    maxTechnicalDebt: 5
  };

  constructor() {
    this.reportsDir = path.join(process.cwd(), 'reports');
    this.ensureReportsDirectory();
  }

  private ensureReportsDirectory(): void {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  /**
   * Collect current quality metrics
   */
  async collectMetrics(): Promise<QualityMetrics> {
    console.log('📊 Collecting quality metrics...');

    const metrics: QualityMetrics = {
      timestamp: new Date().toISOString(),
      eslintErrors: await this.getEslintErrors(),
      eslintWarnings: await this.getEslintWarnings(),
      deadCodeCount: await this.getDeadCodeCount(),
      unusedImports: await this.getUnusedImportsCount(),
      testCoverage: await this.getTestCoverage(),
      complexityScore: await this.getComplexityScore(),
      maintainabilityIndex: await this.getMaintainabilityIndex(),
      technicalDebtRatio: await this.getTechnicalDebtRatio()
    };

    console.log('✅ Metrics collection completed');
    return metrics;
  }

  private async getEslintErrors(): Promise<number> {
    try {
      const result = execSync('cd frontend && npx eslint src/ --ext .ts,.tsx,.js,.jsx --format json', 
        { encoding: 'utf8', stdio: 'pipe' });
      const eslintResults = JSON.parse(result);
      return eslintResults.reduce((total: number, file: any) => 
        total + file.messages.filter((msg: any) => msg.severity === 2).length, 0);
    } catch (error) {
      console.warn('⚠️  Could not get ESLint errors:', error);
      return 0;
    }
  }

  private async getEslintWarnings(): Promise<number> {
    try {
      const result = execSync('cd frontend && npx eslint src/ --ext .ts,.tsx,.js,.jsx --format json', 
        { encoding: 'utf8', stdio: 'pipe' });
      const eslintResults = JSON.parse(result);
      return eslintResults.reduce((total: number, file: any) => 
        total + file.messages.filter((msg: any) => msg.severity === 1).length, 0);
    } catch (error) {
      console.warn('⚠️  Could not get ESLint warnings:', error);
      return 0;
    }
  }

  private async getDeadCodeCount(): Promise<number> {
    try {
      const result = execSync('cd frontend && npx ts-unused-exports tsconfig.json', 
        { encoding: 'utf8', stdio: 'pipe' });
      return result.trim().split('\n').filter(line => line.trim().length > 0).length;
    } catch (error) {
      console.warn('⚠️  Could not get dead code count:', error);
      return 0;
    }
  }

  private async getUnusedImportsCount(): Promise<number> {
    try {
      const result = execSync('cd frontend && npx unimported', 
        { encoding: 'utf8', stdio: 'pipe' });
      // Count files with unused imports
      return (result.match(/\.tsx?:/g) || []).length;
    } catch (error) {
      console.warn('⚠️  Could not get unused imports count:', error);
      return 0;
    }
  }

  private async getTestCoverage(): Promise<number> {
    try {
      // Run tests with coverage
      execSync('cd frontend && npm test -- --coverage --watchAll=false', 
        { encoding: 'utf8', stdio: 'pipe' });
      
      // Read coverage summary
      const coveragePath = path.join('frontend', 'coverage', 'coverage-summary.json');
      if (fs.existsSync(coveragePath)) {
        const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
        return coverage.total.lines.pct || 0;
      }
      return 0;
    } catch (error) {
      console.warn('⚠️  Could not get test coverage:', error);
      return 0;
    }
  }

  private async getComplexityScore(): Promise<number> {
    try {
      // Use complexity analysis from ESLint
      const result = execSync('cd frontend && npx eslint src/ --ext .ts,.tsx,.js,.jsx --format json', 
        { encoding: 'utf8', stdio: 'pipe' });
      const eslintResults = JSON.parse(result);
      
      let totalComplexity = 0;
      let functionCount = 0;
      
      eslintResults.forEach((file: any) => {
        file.messages.forEach((msg: any) => {
          if (msg.ruleId === 'complexity') {
            totalComplexity += parseInt(msg.message.match(/\d+/)?.[0] || '0');
            functionCount++;
          }
        });
      });
      
      return functionCount > 0 ? totalComplexity / functionCount : 0;
    } catch (error) {
      console.warn('⚠️  Could not get complexity score:', error);
      return 0;
    }
  }

  private async getMaintainabilityIndex(): Promise<number> {
    // Simplified maintainability calculation based on various factors
    try {
      const eslintErrors = await this.getEslintErrors();
      const eslintWarnings = await this.getEslintWarnings();
      const deadCode = await this.getDeadCodeCount();
      const coverage = await this.getTestCoverage();
      
      // Simple maintainability formula (100 - penalties)
      let maintainability = 100;
      maintainability -= eslintErrors * 2; // 2 points per error
      maintainability -= eslintWarnings * 0.5; // 0.5 points per warning
      maintainability -= deadCode * 1; // 1 point per dead code issue
      maintainability += (coverage - 50) * 0.3; // Bonus for good coverage
      
      return Math.max(0, Math.min(100, maintainability));
    } catch (error) {
      console.warn('⚠️  Could not calculate maintainability index:', error);
      return 50; // Default neutral score
    }
  }

  private async getTechnicalDebtRatio(): Promise<number> {
    try {
      const eslintErrors = await this.getEslintErrors();
      const eslintWarnings = await this.getEslintWarnings();
      const deadCode = await this.getDeadCodeCount();
      
      // Calculate total lines of code
      const result = execSync('find frontend/src -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | xargs wc -l | tail -1', 
        { encoding: 'utf8' });
      const totalLines = parseInt(result.trim().split(/\s+/)[0]) || 1;
      
      // Technical debt = (issues / total lines) * 100
      const totalIssues = eslintErrors + eslintWarnings + deadCode;
      return (totalIssues / totalLines) * 100;
    } catch (error) {
      console.warn('⚠️  Could not calculate technical debt ratio:', error);
      return 0;
    }
  }

  /**
   * Analyze quality trends
   */
  private analyzeQualityTrends(current: QualityMetrics): any {
    const historicalData = this.getHistoricalMetrics();
    if (historicalData.length < 2) {
      return {
        eslintTrend: 0,
        deadCodeTrend: 0,
        coverageTrend: 0,
        maintainabilityTrend: 0
      };
    }

    const previous = historicalData[historicalData.length - 2];
    return {
      eslintTrend: current.eslintErrors - previous.eslintErrors,
      deadCodeTrend: current.deadCodeCount - previous.deadCodeCount,
      coverageTrend: current.testCoverage - previous.testCoverage,
      maintainabilityTrend: current.maintainabilityIndex - previous.maintainabilityIndex
    };
  }

  /**
   * Check quality gates
   */
  private checkQualityGates(metrics: QualityMetrics): { passed: string[], failed: string[] } {
    const passed: string[] = [];
    const failed: string[] = [];

    if (metrics.eslintErrors <= this.qualityThresholds.maxEslintErrors) {
      passed.push(`ESLint Errors: ${metrics.eslintErrors} ≤ ${this.qualityThresholds.maxEslintErrors}`);
    } else {
      failed.push(`ESLint Errors: ${metrics.eslintErrors} > ${this.qualityThresholds.maxEslintErrors}`);
    }

    if (metrics.eslintWarnings <= this.qualityThresholds.maxEslintWarnings) {
      passed.push(`ESLint Warnings: ${metrics.eslintWarnings} ≤ ${this.qualityThresholds.maxEslintWarnings}`);
    } else {
      failed.push(`ESLint Warnings: ${metrics.eslintWarnings} > ${this.qualityThresholds.maxEslintWarnings}`);
    }

    if (metrics.deadCodeCount <= this.qualityThresholds.maxDeadCode) {
      passed.push(`Dead Code: ${metrics.deadCodeCount} ≤ ${this.qualityThresholds.maxDeadCode}`);
    } else {
      failed.push(`Dead Code: ${metrics.deadCodeCount} > ${this.qualityThresholds.maxDeadCode}`);
    }

    if (metrics.testCoverage >= this.qualityThresholds.minTestCoverage) {
      passed.push(`Test Coverage: ${metrics.testCoverage}% ≥ ${this.qualityThresholds.minTestCoverage}%`);
    } else {
      failed.push(`Test Coverage: ${metrics.testCoverage}% < ${this.qualityThresholds.minTestCoverage}%`);
    }

    if (metrics.maintainabilityIndex >= this.qualityThresholds.minMaintainability) {
      passed.push(`Maintainability: ${metrics.maintainabilityIndex} ≥ ${this.qualityThresholds.minMaintainability}`);
    } else {
      failed.push(`Maintainability: ${metrics.maintainabilityIndex} < ${this.qualityThresholds.minMaintainability}`);
    }

    return { passed, failed };
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(metrics: QualityMetrics): string[] {
    const recommendations: string[] = [];

    if (metrics.eslintErrors > 0) {
      recommendations.push(`Fix ${metrics.eslintErrors} ESLint errors to improve code quality`);
    }

    if (metrics.eslintWarnings > 5) {
      recommendations.push(`Address ${metrics.eslintWarnings} ESLint warnings to prevent technical debt`);
    }

    if (metrics.deadCodeCount > 0) {
      recommendations.push(`Remove ${metrics.deadCodeCount} dead code exports to clean up codebase`);
    }

    if (metrics.unusedImports > 0) {
      recommendations.push(`Clean up ${metrics.unusedImports} files with unused imports`);
    }

    if (metrics.testCoverage < 80) {
      recommendations.push(`Increase test coverage from ${metrics.testCoverage}% to at least 80%`);
    }

    if (metrics.complexityScore > 8) {
      recommendations.push(`Reduce code complexity (current: ${metrics.complexityScore}, target: ≤8)`);
    }

    if (metrics.maintainabilityIndex < 70) {
      recommendations.push(`Improve maintainability score from ${metrics.maintainabilityIndex} to at least 70`);
    }

    if (recommendations.length === 0) {
      recommendations.push('🎉 Code quality looks excellent! Keep up the good work!');
    }

    return recommendations;
  }

  /**
   * Save metrics to history
   */
  private saveMetrics(metrics: QualityMetrics): void {
    const historyFile = path.join(this.reportsDir, 'quality_history.json');
    let history: QualityMetrics[] = [];

    if (fs.existsSync(historyFile)) {
      try {
        history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
      } catch (error) {
        console.warn('⚠️  Could not read quality history, starting fresh');
      }
    }

    history.push(metrics);
    
    // Keep only last 100 entries
    if (history.length > 100) {
      history = history.slice(-100);
    }

    fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
  }

  /**
   * Get historical metrics
   */
  private getHistoricalMetrics(): QualityMetrics[] {
    const historyFile = path.join(this.reportsDir, 'quality_history.json');
    if (fs.existsSync(historyFile)) {
      try {
        return JSON.parse(fs.readFileSync(historyFile, 'utf8'));
      } catch (error) {
        console.warn('⚠️  Could not read quality history');
      }
    }
    return [];
  }

  /**
   * Generate and save quality report
   */
  async generateReport(): Promise<QualityReport> {
    console.log('📊 Generating quality dashboard report...');

    const metrics = await this.collectMetrics();
    const trends = this.analyzeQualityTrends(metrics);
    const gates = this.checkQualityGates(metrics);
    const recommendations = this.generateRecommendations(metrics);

    const report: QualityReport = {
      reportId: `quality_${Date.now()}`,
      generatedAt: new Date().toISOString(),
      summary: metrics,
      trends,
      recommendations,
      passedGates: gates.passed,
      failedGates: gates.failed
    };

    // Save metrics to history
    this.saveMetrics(metrics);

    // Save full report
    const reportFile = path.join(this.reportsDir, `${report.reportId}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

    // Generate HTML dashboard
    await this.generateHtmlDashboard(report);

    console.log('✅ Quality report generated');
    return report;
  }

  /**
   * Generate HTML dashboard
   */
  private async generateHtmlDashboard(report: QualityReport): Promise<void> {
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Code Quality Dashboard - Vibes</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: #2196F3; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric-value { font-size: 2em; font-weight: bold; margin-bottom: 5px; }
        .metric-label { color: #666; font-size: 0.9em; }
        .good { color: #4CAF50; }
        .warning { color: #FF9800; }
        .error { color: #F44336; }
        .recommendations { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .quality-gates { background: white; padding: 20px; border-radius: 8px; }
        .gate-passed { color: #4CAF50; margin: 5px 0; }
        .gate-failed { color: #F44336; margin: 5px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎯 Code Quality Dashboard</h1>
            <p>Generated: ${new Date(report.generatedAt).toLocaleString()}</p>
        </div>

        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-value ${report.summary.eslintErrors === 0 ? 'good' : 'error'}">${report.summary.eslintErrors}</div>
                <div class="metric-label">ESLint Errors</div>
            </div>
            <div class="metric-card">
                <div class="metric-value ${report.summary.eslintWarnings <= 5 ? 'good' : 'warning'}">${report.summary.eslintWarnings}</div>
                <div class="metric-label">ESLint Warnings</div>
            </div>
            <div class="metric-card">
                <div class="metric-value ${report.summary.deadCodeCount === 0 ? 'good' : 'warning'}">${report.summary.deadCodeCount}</div>
                <div class="metric-label">Dead Code Issues</div>
            </div>
            <div class="metric-card">
                <div class="metric-value ${report.summary.testCoverage >= 80 ? 'good' : report.summary.testCoverage >= 60 ? 'warning' : 'error'}">${report.summary.testCoverage.toFixed(1)}%</div>
                <div class="metric-label">Test Coverage</div>
            </div>
            <div class="metric-card">
                <div class="metric-value ${report.summary.maintainabilityIndex >= 80 ? 'good' : report.summary.maintainabilityIndex >= 60 ? 'warning' : 'error'}">${report.summary.maintainabilityIndex.toFixed(1)}</div>
                <div class="metric-label">Maintainability Index</div>
            </div>
            <div class="metric-card">
                <div class="metric-value ${report.summary.technicalDebtRatio <= 2 ? 'good' : report.summary.technicalDebtRatio <= 5 ? 'warning' : 'error'}">${report.summary.technicalDebtRatio.toFixed(1)}%</div>
                <div class="metric-label">Technical Debt Ratio</div>
            </div>
        </div>

        <div class="recommendations">
            <h2>📋 Recommendations</h2>
            ${report.recommendations.map(rec => `<p>• ${rec}</p>`).join('')}
        </div>

        <div class="quality-gates">
            <h2>🚦 Quality Gates</h2>
            <h3>✅ Passed</h3>
            ${report.passedGates.map(gate => `<div class="gate-passed">✓ ${gate}</div>`).join('')}
            
            ${report.failedGates.length > 0 ? `
            <h3>❌ Failed</h3>
            ${report.failedGates.map(gate => `<div class="gate-failed">✗ ${gate}</div>`).join('')}
            ` : ''}
        </div>
    </div>
</body>
</html>`;

    const dashboardFile = path.join(this.reportsDir, 'quality_dashboard.html');
    fs.writeFileSync(dashboardFile, htmlContent);
  }

  /**
   * Display console summary
   */
  displaySummary(report: QualityReport): void {
    console.log('\n📊 Quality Dashboard Summary');
    console.log('============================');
    console.log(`Report ID: ${report.reportId}`);
    console.log(`Generated: ${new Date(report.generatedAt).toLocaleString()}`);
    console.log('');
    
    console.log('📈 Key Metrics:');
    console.log(`  ESLint Errors: ${report.summary.eslintErrors}`);
    console.log(`  ESLint Warnings: ${report.summary.eslintWarnings}`);
    console.log(`  Dead Code: ${report.summary.deadCodeCount}`);
    console.log(`  Test Coverage: ${report.summary.testCoverage.toFixed(1)}%`);
    console.log(`  Maintainability: ${report.summary.maintainabilityIndex}`);
    console.log(`  Technical Debt: ${report.summary.technicalDebtRatio.toFixed(1)}%`);
    console.log('');

    console.log('🚦 Quality Gates:');
    console.log(`  Passed: ${report.passedGates.length}`);
    console.log(`  Failed: ${report.failedGates.length}`);
    console.log('');

    if (report.failedGates.length > 0) {
      console.log('❌ Failed Gates:');
      report.failedGates.forEach(gate => console.log(`  • ${gate}`));
      console.log('');
    }

    console.log('📋 Top Recommendations:');
    report.recommendations.slice(0, 3).forEach(rec => console.log(`  • ${rec}`));
    console.log('');

    console.log(`📄 Full dashboard: ${path.join(this.reportsDir, 'quality_dashboard.html')}`);
    console.log(`📊 Report details: ${path.join(this.reportsDir, report.reportId + '.json')}`);
  }
}

// Main execution
async function main(): Promise<void> {
  try {
    const dashboard = new QualityDashboard();
    const report = await dashboard.generateReport();
    dashboard.displaySummary(report);
    
    // Exit with error code if quality gates failed
    if (report.failedGates.length > 0) {
      console.log('\n❌ Quality gates failed. Please address the issues above.');
      process.exit(1);
    } else {
      console.log('\n✅ All quality gates passed!');
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Error generating quality dashboard:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { QualityDashboard, QualityMetrics, QualityReport }; 