/**
 * Deletes all secret tags from the server.
 * This is a sensitive operation and should be used with care.
 */
async deleteAllSecretTags(): Promise<void> {
  try {
    const serverTagsResponse = await secretTagHashService.getSecretTags();
    const serverTags = serverTagsResponse.tags || [];
    
    const deletionPromises = serverTags.map(tag =>
      secretTagHashService.deleteSecretTag(tag.id)
    );
    
    await Promise.all(deletionPromises);
    logger.info(`Deleted ${serverTags.length} secret tags from the server.`);
    
  } catch (error) {
    logger.error('Failed to delete all secret tags:', error);
    throw error;
  }
}

/**
 * Filter a list of journal entries based on active secret tags.
 */
// ... existing code ... 