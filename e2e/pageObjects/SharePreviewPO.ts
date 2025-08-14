import { element, by, expect, waitFor } from 'detox';
import { TestUtils } from '../setup';

export class SharePreviewPO {
  // Screen elements
  get sharePreviewScreen() {
    return element(by.id('share-preview-screen'));
  }

  get backButton() {
    return element(by.id('back-button'));
  }

  get shareTitle() {
    return element(by.id('share-title'));
  }

  get dateRangeInfo() {
    return element(by.id('date-range-info'));
  }

  // Q&A elements
  get qaItemsList() {
    return element(by.id('qa-items-list'));
  }

  get qaItems() {
    return element(by.id('qa-items'));
  }

  getQAItem(index: number) {
    return element(by.id(`qa-item-${index}`));
  }

  getQuestionText(index: number) {
    return element(by.id(`question-${index}`));
  }

  getAnswerText(index: number) {
    return element(by.id(`answer-${index}`));
  }

  getEditButton(index: number) {
    return element(by.id(`edit-answer-${index}`));
  }

  getConfidenceIndicator(index: number) {
    return element(by.id(`confidence-${index}`));
  }

  // Edit mode elements
  get answerInput() {
    return element(by.id('answer-input'));
  }

  get saveButton() {
    return element(by.id('save-answer'));
  }

  get cancelButton() {
    return element(by.id('cancel-edit'));
  }

  // Share action elements
  get shareButton() {
    return element(by.id('share-button'));
  }

  get shareOptionsModal() {
    return element(by.id('share-options-modal'));
  }

  // Loading elements
  get generationProgress() {
    return element(by.id('generation-progress'));
  }

  get loadingIndicator() {
    return element(by.id('loading-indicator'));
  }

  get progressSteps() {
    return element(by.id('progress-steps'));
  }

  get estimatedTime() {
    return element(by.id('estimated-time'));
  }

  // Methods
  async waitForScreenToLoad(timeout = 30000) {
    // First wait for loading/generation to complete
    await this.waitForGenerationComplete(timeout);
    
    // Then verify the preview screen is visible
    await waitFor(this.sharePreviewScreen)
      .toBeVisible()
      .withTimeout(5000);
    
    await expect(this.qaItems).toBeVisible();
  }

  async waitForGenerationComplete(timeout = 30000) {
    try {
      // Wait for generation progress to be visible first
      await waitFor(this.generationProgress)
        .toBeVisible()
        .withTimeout(5000);
      
      console.log('📊 Share generation started');
    } catch (error) {
      // Generation might be very fast, continue
    }

    // Wait for loading to complete
    await TestUtils.waitForLoadingToComplete(timeout);
    
    // Wait for generation progress to disappear
    try {
      await waitFor(this.generationProgress)
        .not.toBeVisible()
        .withTimeout(timeout);
      
      console.log('✅ Share generation completed');
    } catch (error) {
      // Progress might not be visible, which is fine
    }
  }

  async verifyShareContent() {
    await expect(this.shareTitle).toBeVisible();
    await expect(this.qaItems).toBeVisible();
    
    // Verify at least one Q&A item is present
    await expect(this.getQAItem(0)).toBeVisible();
    await expect(this.getQuestionText(0)).toBeVisible();
    await expect(this.getAnswerText(0)).toBeVisible();
  }

  async editAnswer(itemIndex: number, newAnswer: string) {
    // Tap the edit button for the specific item
    const editButton = this.getEditButton(itemIndex);
    await editButton.tap();
    
    // Wait for edit mode to activate
    await waitFor(this.answerInput)
      .toBeVisible()
      .withTimeout(5000);
    
    // Clear and type new answer
    await this.answerInput.clearText();
    await TestUtils.typeTextSlowly(by.id('answer-input'), newAnswer, 50);
    
    // Save the changes
    await this.saveButton.tap();
    
    // Wait for edit mode to close
    await waitFor(this.answerInput)
      .not.toBeVisible()
      .withTimeout(5000);
  }

  async cancelEdit() {
    await this.cancelButton.tap();
    
    // Wait for edit mode to close
    await waitFor(this.answerInput)
      .not.toBeVisible()
      .withTimeout(5000);
  }

  async shareContent() {
    await expect(this.shareButton).toBeVisible();
    await this.shareButton.tap();
    
    // Wait for share options modal to appear
    await waitFor(this.shareOptionsModal)
      .toBeVisible()
      .withTimeout(5000);
  }

  async goBack() {
    await this.backButton.tap();
  }

  async verifyQuestionAndAnswer(index: number, expectedQuestion?: string, expectedAnswer?: string) {
    const questionElement = this.getQuestionText(index);
    const answerElement = this.getAnswerText(index);
    
    await expect(questionElement).toBeVisible();
    await expect(answerElement).toBeVisible();
    
    if (expectedQuestion) {
      await expect(questionElement).toHaveText(expectedQuestion);
    }
    
    if (expectedAnswer) {
      await expect(answerElement).toHaveText(expectedAnswer);
    }
  }

  async verifyConfidenceLevel(index: number, expectedConfidence?: string) {
    const confidenceElement = this.getConfidenceIndicator(index);
    await expect(confidenceElement).toBeVisible();
    
    if (expectedConfidence) {
      await expect(confidenceElement).toHaveText(expectedConfidence);
    }
  }

  async scrollToQAItem(index: number) {
    await TestUtils.scrollToElement(
      'qa-items-list',
      by.id(`qa-item-${index}`),
      'down',
      5
    );
  }

  async verifyGenerationProgress() {
    await expect(this.generationProgress).toBeVisible();
    
    // Verify progress steps are visible
    await expect(this.progressSteps).toBeVisible();
    
    // Check if estimated time is shown
    try {
      await expect(this.estimatedTime).toBeVisible();
    } catch (error) {
      // Estimated time might not always be shown
    }
  }

  async waitForSpecificStep(stepName: string, timeout = 10000) {
    const stepElement = element(by.text(stepName));
    await waitFor(stepElement)
      .toBeVisible()
      .withTimeout(timeout);
  }

  async verifyShareTitle(expectedTitle?: string) {
    await expect(this.shareTitle).toBeVisible();
    
    if (expectedTitle) {
      await expect(this.shareTitle).toHaveText(expectedTitle);
    }
  }

  async verifyDateRangeInfo(expectedRange?: string) {
    await expect(this.dateRangeInfo).toBeVisible();
    
    if (expectedRange) {
      await expect(this.dateRangeInfo).toHaveText(expectedRange);
    }
  }

  async countQAItems(): Promise<number> {
    // This would require a custom implementation to count visible elements
    // For now, we'll return a placeholder
    return 3; // Assuming typical number of Q&A items
  }

  async takeScreenshot(name: string) {
    await TestUtils.takeScreenshot(`share-preview-${name}`);
  }

  // Verification methods
  async verifyScreenElements() {
    await expect(this.sharePreviewScreen).toBeVisible();
    await expect(this.backButton).toBeVisible();
    await expect(this.shareTitle).toBeVisible();
    await expect(this.qaItems).toBeVisible();
    await expect(this.shareButton).toBeVisible();
  }

  async verifyEditMode(isActive: boolean) {
    if (isActive) {
      await expect(this.answerInput).toBeVisible();
      await expect(this.saveButton).toBeVisible();
      await expect(this.cancelButton).toBeVisible();
    } else {
      await expect(this.answerInput).not.toBeVisible();
      await expect(this.saveButton).not.toBeVisible();
      await expect(this.cancelButton).not.toBeVisible();
    }
  }
}
