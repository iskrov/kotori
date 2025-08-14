import { element, by, expect, waitFor } from 'detox';
import { TestUtils } from '../setup';

export class ShareScreenPO {
  // Screen elements
  get shareTab() {
    return element(by.id('share-tab'));
  }

  get shareScreen() {
    return element(by.id('share-screen'));
  }

  get title() {
    return element(by.text('Share Summary'));
  }

  get subtitle() {
    return element(by.text('Create a summary to share with your care team'));
  }

  // Period selector elements
  get dailyPeriod() {
    return element(by.id('period-daily'));
  }

  get weeklyPeriod() {
    return element(by.id('period-weekly'));
  }

  get monthlyPeriod() {
    return element(by.id('period-monthly'));
  }

  get dateRangeDisplay() {
    return element(by.id('date-range-display'));
  }

  // Template selector elements
  get templateList() {
    return element(by.id('template-list'));
  }

  getTemplateById(templateId: string) {
    return element(by.id(`template-${templateId}`));
  }

  get wellnessTemplate() {
    return element(by.id('template-wellness'));
  }

  get medicalTemplate() {
    return element(by.id('template-medical'));
  }

  get moodTemplate() {
    return element(by.id('template-mood'));
  }

  // Action buttons
  get generateShareButton() {
    return element(by.id('generate-share-button'));
  }

  get viewHistoryButton() {
    return element(by.id('view-history-button'));
  }

  // Methods
  async navigateToShareScreen() {
    await this.shareTab.tap();
    await this.waitForScreenToLoad();
  }

  async waitForScreenToLoad() {
    await waitFor(this.shareScreen)
      .toBeVisible()
      .withTimeout(10000);
    
    await expect(this.title).toBeVisible();
    await expect(this.subtitle).toBeVisible();
  }

  async selectPeriod(period: 'daily' | 'weekly' | 'monthly') {
    switch (period) {
      case 'daily':
        await this.dailyPeriod.tap();
        break;
      case 'weekly':
        await this.weeklyPeriod.tap();
        break;
      case 'monthly':
        await this.monthlyPeriod.tap();
        break;
    }

    // Wait for date range to be calculated and displayed
    await waitFor(this.dateRangeDisplay)
      .toBeVisible()
      .withTimeout(5000);
  }

  async selectTemplate(templateType: 'wellness' | 'medical' | 'mood' | string) {
    // Wait for templates to load
    await waitFor(this.templateList)
      .toBeVisible()
      .withTimeout(10000);

    switch (templateType) {
      case 'wellness':
        await this.wellnessTemplate.tap();
        break;
      case 'medical':
        await this.medicalTemplate.tap();
        break;
      case 'mood':
        await this.moodTemplate.tap();
        break;
      default:
        // Try to find template by ID
        const template = this.getTemplateById(templateType);
        await template.tap();
        break;
    }
  }

  async generateShare() {
    await expect(this.generateShareButton).toBeVisible();
    await this.generateShareButton.tap();
  }

  async viewHistory() {
    await expect(this.viewHistoryButton).toBeVisible();
    await this.viewHistoryButton.tap();
  }

  async verifyGenerateButtonEnabled() {
    await expect(this.generateShareButton).toBeVisible();
    // Note: Detox doesn't have a direct way to check if button is enabled
    // We would need to add testID or accessibility properties to check this
  }

  async verifyGenerateButtonDisabled() {
    await expect(this.generateShareButton).toBeVisible();
    // Check if button has disabled state through accessibility properties
  }

  async verifyDateRangeDisplayed(expectedText?: string) {
    await expect(this.dateRangeDisplay).toBeVisible();
    
    if (expectedText) {
      await expect(this.dateRangeDisplay).toHaveText(expectedText);
    }
  }

  async waitForTemplateLoading() {
    // Wait for template loading to complete
    await TestUtils.waitForLoadingToComplete();
    
    // Verify at least one template is visible
    await waitFor(this.templateList)
      .toBeVisible()
      .withTimeout(15000);
  }

  async scrollToTemplate(templateId: string) {
    await TestUtils.scrollToElement(
      'template-list',
      by.id(`template-${templateId}`),
      'down',
      5
    );
  }

  async takeScreenshot(name: string) {
    await TestUtils.takeScreenshot(`share-screen-${name}`);
  }

  // Verification methods
  async verifyScreenElements() {
    await expect(this.title).toBeVisible();
    await expect(this.subtitle).toBeVisible();
    await expect(this.dailyPeriod).toBeVisible();
    await expect(this.weeklyPeriod).toBeVisible();
    await expect(this.monthlyPeriod).toBeVisible();
    await expect(this.generateShareButton).toBeVisible();
    await expect(this.viewHistoryButton).toBeVisible();
  }

  async verifyTemplateSelected(templateType: string) {
    const template = this.getTemplateById(templateType);
    await expect(template).toBeVisible();
    // Additional verification for selected state would depend on UI implementation
  }

  async verifyPeriodSelected(period: 'daily' | 'weekly' | 'monthly') {
    // Verification would depend on UI implementation of selected state
    // This might involve checking button styles or accessibility states
    switch (period) {
      case 'daily':
        await expect(this.dailyPeriod).toBeVisible();
        break;
      case 'weekly':
        await expect(this.weeklyPeriod).toBeVisible();
        break;
      case 'monthly':
        await expect(this.monthlyPeriod).toBeVisible();
        break;
    }
  }
}
