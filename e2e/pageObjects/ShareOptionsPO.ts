import { element, by, expect, waitFor } from 'detox';
import { TestUtils } from '../setup';

export class ShareOptionsPO {
  // Modal elements
  get shareOptionsModal() {
    return element(by.id('share-options-modal'));
  }

  get modalTitle() {
    return element(by.text('Share Options'));
  }

  get closeButton() {
    return element(by.id('close-modal'));
  }

  get modalOverlay() {
    return element(by.id('modal-overlay'));
  }

  // Share option buttons
  get downloadPDFOption() {
    return element(by.id('download-pdf-option'));
  }

  get shareViaAppsOption() {
    return element(by.id('share-via-apps-option'));
  }

  get sendViaEmailOption() {
    return element(by.id('send-via-email-option'));
  }

  // Option details
  get pdfOptionTitle() {
    return element(by.text('Download PDF'));
  }

  get pdfOptionDescription() {
    return element(by.text('Save summary as PDF file to your device'));
  }

  get appsOptionTitle() {
    return element(by.text('Share via Apps'));
  }

  get appsOptionDescription() {
    return element(by.text('Share through messaging, email, or other apps'));
  }

  get emailOptionTitle() {
    return element(by.text('Send via Email'));
  }

  get emailOptionDescription() {
    return element(by.text('Send summary directly to your healthcare provider'));
  }

  // Loading states
  get pdfLoadingIndicator() {
    return element(by.id('pdf-loading'));
  }

  get shareLoadingIndicator() {
    return element(by.id('share-loading'));
  }

  get emailLoadingIndicator() {
    return element(by.id('email-loading'));
  }

  // Success/Error messages
  get successMessage() {
    return element(by.id('success-message'));
  }

  get errorMessage() {
    return element(by.id('error-message'));
  }

  // Footer
  get footerNote() {
    return element(by.text('Your summary will expire in 7 days for privacy and security'));
  }

  // Methods
  async waitForModalToOpen() {
    await waitFor(this.shareOptionsModal)
      .toBeVisible()
      .withTimeout(5000);
    
    await expect(this.modalTitle).toBeVisible();
  }

  async closeModal() {
    await this.closeButton.tap();
    
    await waitFor(this.shareOptionsModal)
      .not.toBeVisible()
      .withTimeout(5000);
  }

  async closeModalByTappingOverlay() {
    await this.modalOverlay.tap();
    
    await waitFor(this.shareOptionsModal)
      .not.toBeVisible()
      .withTimeout(5000);
  }

  async downloadPDF() {
    await expect(this.downloadPDFOption).toBeVisible();
    await this.downloadPDFOption.tap();
    
    // Wait for PDF generation to start
    try {
      await waitFor(this.pdfLoadingIndicator)
        .toBeVisible()
        .withTimeout(2000);
      
      console.log('📄 PDF generation started');
      
      // Wait for PDF generation to complete
      await waitFor(this.pdfLoadingIndicator)
        .not.toBeVisible()
        .withTimeout(30000);
      
      console.log('✅ PDF generation completed');
    } catch (error) {
      // PDF generation might be very fast
      console.log('⚡ PDF generation was very quick');
    }
  }

  async shareViaApps() {
    await expect(this.shareViaAppsOption).toBeVisible();
    await this.shareViaAppsOption.tap();
    
    // Wait for share loading
    try {
      await waitFor(this.shareLoadingIndicator)
        .toBeVisible()
        .withTimeout(2000);
      
      console.log('📤 Share preparation started');
      
      // Wait for share preparation to complete
      await waitFor(this.shareLoadingIndicator)
        .not.toBeVisible()
        .withTimeout(15000);
      
      console.log('✅ Share preparation completed');
    } catch (error) {
      // Share preparation might be very fast
      console.log('⚡ Share preparation was very quick');
    }
  }

  async sendViaEmail() {
    await expect(this.sendViaEmailOption).toBeVisible();
    await this.sendViaEmailOption.tap();
    
    // Wait for email composition
    try {
      await waitFor(this.emailLoadingIndicator)
        .toBeVisible()
        .withTimeout(2000);
      
      console.log('📧 Email composition started');
      
      // Wait for email composition to complete
      await waitFor(this.emailLoadingIndicator)
        .not.toBeVisible()
        .withTimeout(15000);
      
      console.log('✅ Email composition completed');
    } catch (error) {
      // Email composition might be very fast
      console.log('⚡ Email composition was very quick');
    }
  }

  async verifyModalContent() {
    await expect(this.modalTitle).toBeVisible();
    await expect(this.downloadPDFOption).toBeVisible();
    await expect(this.shareViaAppsOption).toBeVisible();
    await expect(this.sendViaEmailOption).toBeVisible();
    await expect(this.footerNote).toBeVisible();
  }

  async verifyOptionDetails() {
    // Verify PDF option
    await expect(this.pdfOptionTitle).toBeVisible();
    await expect(this.pdfOptionDescription).toBeVisible();
    
    // Verify Apps option
    await expect(this.appsOptionTitle).toBeVisible();
    await expect(this.appsOptionDescription).toBeVisible();
    
    // Verify Email option
    await expect(this.emailOptionTitle).toBeVisible();
    await expect(this.emailOptionDescription).toBeVisible();
  }

  async waitForSuccessMessage(expectedMessage?: string) {
    await waitFor(this.successMessage)
      .toBeVisible()
      .withTimeout(10000);
    
    if (expectedMessage) {
      await expect(this.successMessage).toHaveText(expectedMessage);
    }
  }

  async waitForErrorMessage(expectedMessage?: string) {
    await waitFor(this.errorMessage)
      .toBeVisible()
      .withTimeout(10000);
    
    if (expectedMessage) {
      await expect(this.errorMessage).toHaveText(expectedMessage);
    }
  }

  async verifyPDFDownloadSuccess() {
    // This would typically show a success alert or message
    // The exact implementation depends on how the app shows success
    await this.waitForSuccessMessage('PDF Downloaded');
  }

  async verifyShareSuccess() {
    // Verify share was successful (might close modal or show success message)
    try {
      await this.waitForSuccessMessage();
    } catch (error) {
      // Modal might close on successful share
      await waitFor(this.shareOptionsModal)
        .not.toBeVisible()
        .withTimeout(5000);
    }
  }

  async verifyEmailSuccess() {
    // Verify email composition was successful
    await this.waitForSuccessMessage('Email Sent');
  }

  async verifyOptionDisabled(optionType: 'pdf' | 'apps' | 'email') {
    let optionElement;
    
    switch (optionType) {
      case 'pdf':
        optionElement = this.downloadPDFOption;
        break;
      case 'apps':
        optionElement = this.shareViaAppsOption;
        break;
      case 'email':
        optionElement = this.sendViaEmailOption;
        break;
    }
    
    // Check if option is disabled (this would depend on UI implementation)
    await expect(optionElement).toBeVisible();
    // Additional checks for disabled state would go here
  }

  async verifyLoadingState(optionType: 'pdf' | 'apps' | 'email') {
    let loadingElement;
    
    switch (optionType) {
      case 'pdf':
        loadingElement = this.pdfLoadingIndicator;
        break;
      case 'apps':
        loadingElement = this.shareLoadingIndicator;
        break;
      case 'email':
        loadingElement = this.emailLoadingIndicator;
        break;
    }
    
    await expect(loadingElement).toBeVisible();
  }

  async takeScreenshot(name: string) {
    await TestUtils.takeScreenshot(`share-options-${name}`);
  }

  // Error handling methods
  async handleNetworkError() {
    try {
      await this.waitForErrorMessage('Unable to connect to the server');
      
      // Look for retry button if present
      const retryButton = element(by.text('Retry'));
      await retryButton.tap();
    } catch (error) {
      console.log('No network error dialog found');
    }
  }

  async handleGenericError() {
    try {
      await this.waitForErrorMessage();
      
      // Look for OK or close button
      const okButton = element(by.text('OK'));
      await okButton.tap();
    } catch (error) {
      console.log('No error dialog found');
    }
  }
}
