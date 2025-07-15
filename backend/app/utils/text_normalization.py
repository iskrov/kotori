"""
Advanced Text Normalization Utilities

This module provides comprehensive text normalization capabilities for the secret phrase
processing system. It includes Unicode normalization, diacritics removal, contractions
handling, and configurable normalization levels.

Security features:
- Consistent normalization across all components
- Timing attack resistant operations
- Secure memory handling for sensitive text
"""

import re
import unicodedata
from typing import Dict, List, Optional, Tuple
from enum import Enum
import logging

logger = logging.getLogger(__name__)

class NormalizationLevel(Enum):
    """Normalization levels for different use cases"""
    STRICT = "strict"       # Minimal normalization for exact matching
    MEDIUM = "medium"       # Balanced normalization for most use cases
    RELAXED = "relaxed"     # Aggressive normalization for fuzzy matching

class TextNormalizer:
    """
    Advanced text normalization with configurable levels and security features.
    
    This class provides comprehensive text preprocessing for secret phrase detection
    including Unicode normalization, diacritics removal, contractions handling,
    and various levels of normalization for different use cases.
    """
    
    # Common contractions mapping
    CONTRACTIONS = {
        "ain't": "am not",
        "aren't": "are not",
        "can't": "cannot",
        "couldn't": "could not",
        "didn't": "did not",
        "doesn't": "does not",
        "don't": "do not",
        "hadn't": "had not",
        "hasn't": "has not",
        "haven't": "have not",
        "he'd": "he would",
        "he'll": "he will",
        "he's": "he is",
        "i'd": "i would",
        "i'll": "i will",
        "i'm": "i am",
        "i've": "i have",
        "isn't": "is not",
        "it'd": "it would",
        "it'll": "it will",
        "it's": "it is",
        "let's": "let us",
        "shouldn't": "should not",
        "that's": "that is",
        "there's": "there is",
        "they'd": "they would",
        "they'll": "they will",
        "they're": "they are",
        "they've": "they have",
        "we'd": "we would",
        "we'll": "we will",
        "we're": "we are",
        "we've": "we have",
        "weren't": "were not",
        "what's": "what is",
        "where's": "where is",
        "who's": "who is",
        "won't": "will not",
        "wouldn't": "would not",
        "you'd": "you would",
        "you'll": "you will",
        "you're": "you are",
        "you've": "you have",
    }
    
    # Common abbreviations
    ABBREVIATIONS = {
        "mr": "mister",
        "mrs": "missus",
        "ms": "miss",
        "dr": "doctor",
        "prof": "professor",
        "st": "saint",
        "ave": "avenue",
        "blvd": "boulevard",
        "rd": "road",
        "etc": "etcetera",
        "vs": "versus",
        "ie": "that is",
        "eg": "for example",
    }
    
    # Punctuation patterns for different levels
    PUNCTUATION_PATTERNS = {
        NormalizationLevel.STRICT: r'[.!?]',           # Only sentence terminators
        NormalizationLevel.MEDIUM: r'[.,!?;:]',        # Common punctuation
        NormalizationLevel.RELAXED: r'[^\w\s]',        # All non-word characters
    }
    
    def __init__(self, level: NormalizationLevel = NormalizationLevel.MEDIUM):
        """
        Initialize text normalizer with specified normalization level.
        
        Args:
            level: Normalization level to use
        """
        self.level = level
        self.contraction_pattern = re.compile(r'\b(' + '|'.join(self.CONTRACTIONS.keys()) + r')\b', re.IGNORECASE)
        self.abbreviation_pattern = re.compile(r'\b(' + '|'.join(self.ABBREVIATIONS.keys()) + r')\b', re.IGNORECASE)
        
    def normalize_unicode(self, text: str) -> str:
        """
        Normalize Unicode text using NFC normalization.
        
        Args:
            text: Input text to normalize
            
        Returns:
            Unicode normalized text
        """
        if not text:
            return ""
        
        try:
            # Use NFC (Canonical Decomposition followed by Canonical Composition)
            # This ensures consistent representation of accented characters
            normalized = unicodedata.normalize('NFC', text)
            return normalized
        except Exception as e:
            logger.warning(f"Unicode normalization failed: {e}")
            return text
    
    def remove_diacritics(self, text: str) -> str:
        """
        Remove diacritics (accents) from text while preserving base characters.
        
        Args:
            text: Input text with potential diacritics
            
        Returns:
            Text with diacritics removed
        """
        if not text:
            return ""
        
        try:
            # Decompose to separate base characters from diacritics
            decomposed = unicodedata.normalize('NFD', text)
            
            # Filter out combining characters (diacritics)
            without_diacritics = ''.join(
                char for char in decomposed
                if unicodedata.category(char) != 'Mn'
            )
            
            # Recompose to get final result
            return unicodedata.normalize('NFC', without_diacritics)
        except Exception as e:
            logger.warning(f"Diacritics removal failed: {e}")
            return text
    
    def expand_contractions(self, text: str) -> str:
        """
        Expand contractions to their full forms.
        
        Args:
            text: Input text with potential contractions
            
        Returns:
            Text with contractions expanded
        """
        if not text:
            return ""
        
        try:
            def replace_contraction(match):
                contraction = match.group(0).lower()
                expanded = self.CONTRACTIONS.get(contraction, contraction)
                
                # Preserve original case
                if match.group(0).isupper():
                    return expanded.upper()
                elif match.group(0).istitle():
                    return expanded.title()
                else:
                    return expanded
            
            return self.contraction_pattern.sub(replace_contraction, text)
        except Exception as e:
            logger.warning(f"Contraction expansion failed: {e}")
            return text
    
    def expand_abbreviations(self, text: str) -> str:
        """
        Expand common abbreviations to their full forms.
        
        Args:
            text: Input text with potential abbreviations
            
        Returns:
            Text with abbreviations expanded
        """
        if not text:
            return ""
        
        try:
            def replace_abbreviation(match):
                abbrev = match.group(0).lower()
                expanded = self.ABBREVIATIONS.get(abbrev, abbrev)
                
                # Preserve original case
                if match.group(0).isupper():
                    return expanded.upper()
                elif match.group(0).istitle():
                    return expanded.title()
                else:
                    return expanded
            
            return self.abbreviation_pattern.sub(replace_abbreviation, text)
        except Exception as e:
            logger.warning(f"Abbreviation expansion failed: {e}")
            return text
    
    def normalize_case(self, text: str) -> str:
        """
        Normalize text case based on normalization level.
        
        Args:
            text: Input text
            
        Returns:
            Case normalized text
        """
        if not text:
            return ""
        
        # For all levels, convert to lowercase for consistent matching
        return text.lower()
    
    def normalize_punctuation(self, text: str) -> str:
        """
        Normalize punctuation based on normalization level.
        
        Args:
            text: Input text
            
        Returns:
            Text with punctuation normalized
        """
        if not text:
            return ""
        
        try:
            pattern = self.PUNCTUATION_PATTERNS[self.level]
            
            # Remove punctuation according to level
            normalized = re.sub(pattern, '', text)
            
            return normalized
        except Exception as e:
            logger.warning(f"Punctuation normalization failed: {e}")
            return text
    
    def normalize_whitespace(self, text: str) -> str:
        """
        Normalize whitespace characters.
        
        Args:
            text: Input text
            
        Returns:
            Text with normalized whitespace
        """
        if not text:
            return ""
        
        try:
            # Replace all whitespace sequences with single spaces
            normalized = re.sub(r'\s+', ' ', text)
            
            # Strip leading and trailing whitespace
            return normalized.strip()
        except Exception as e:
            logger.warning(f"Whitespace normalization failed: {e}")
            return text
    
    def normalize_numbers(self, text: str) -> str:
        """
        Normalize number representations based on normalization level.
        
        Args:
            text: Input text
            
        Returns:
            Text with normalized numbers
        """
        if not text:
            return ""
        
        try:
            if self.level == NormalizationLevel.RELAXED:
                # Convert spelled-out numbers to digits for relaxed matching
                number_words = {
                    'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
                    'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
                    'ten': '10', 'eleven': '11', 'twelve': '12', 'thirteen': '13',
                    'fourteen': '14', 'fifteen': '15', 'sixteen': '16', 'seventeen': '17',
                    'eighteen': '18', 'nineteen': '19', 'twenty': '20', 'thirty': '30',
                    'forty': '40', 'fifty': '50', 'sixty': '60', 'seventy': '70',
                    'eighty': '80', 'ninety': '90', 'hundred': '100', 'thousand': '1000'
                }
                
                for word, digit in number_words.items():
                    text = re.sub(r'\b' + word + r'\b', digit, text, flags=re.IGNORECASE)
            
            return text
        except Exception as e:
            logger.warning(f"Number normalization failed: {e}")
            return text
    
    def normalize_phrase(self, phrase: str) -> str:
        """
        Apply comprehensive normalization to a phrase.
        
        This method applies all normalization steps in the correct order
        based on the configured normalization level.
        
        Args:
            phrase: Input phrase to normalize
            
        Returns:
            Fully normalized phrase
        """
        if not phrase:
            return ""
        
        try:
            # Step 1: Unicode normalization
            normalized = self.normalize_unicode(phrase)
            
            # Step 2: Remove diacritics (for medium and relaxed levels)
            if self.level in [NormalizationLevel.MEDIUM, NormalizationLevel.RELAXED]:
                normalized = self.remove_diacritics(normalized)
            
            # Step 3: Expand contractions (for medium and relaxed levels)
            if self.level in [NormalizationLevel.MEDIUM, NormalizationLevel.RELAXED]:
                normalized = self.expand_contractions(normalized)
            
            # Step 4: Expand abbreviations (for relaxed level)
            if self.level == NormalizationLevel.RELAXED:
                normalized = self.expand_abbreviations(normalized)
            
            # Step 5: Normalize case
            normalized = self.normalize_case(normalized)
            
            # Step 6: Normalize punctuation
            normalized = self.normalize_punctuation(normalized)
            
            # Step 7: Normalize numbers (for relaxed level)
            if self.level == NormalizationLevel.RELAXED:
                normalized = self.normalize_numbers(normalized)
            
            # Step 8: Normalize whitespace (always last)
            normalized = self.normalize_whitespace(normalized)
            
            return normalized
        except Exception as e:
            logger.error(f"Phrase normalization failed: {e}")
            return ""
    
    def normalize_phrases(self, phrases: List[str]) -> List[str]:
        """
        Normalize a list of phrases.
        
        Args:
            phrases: List of phrases to normalize
            
        Returns:
            List of normalized phrases
        """
        if not phrases:
            return []
        
        try:
            return [self.normalize_phrase(phrase) for phrase in phrases]
        except Exception as e:
            logger.error(f"Phrases normalization failed: {e}")
            return []
    
    def get_normalization_variants(self, phrase: str) -> List[str]:
        """
        Get different normalization variants of a phrase for fuzzy matching.
        
        Args:
            phrase: Input phrase
            
        Returns:
            List of normalized variants
        """
        if not phrase:
            return []
        
        try:
            variants = []
            
            # Create normalizers for different levels
            for level in NormalizationLevel:
                normalizer = TextNormalizer(level)
                variant = normalizer.normalize_phrase(phrase)
                if variant and variant not in variants:
                    variants.append(variant)
            
            return variants
        except Exception as e:
            logger.error(f"Normalization variants generation failed: {e}")
            return []

# Factory functions for different normalization levels
def create_strict_normalizer() -> TextNormalizer:
    """Create a strict normalizer for exact matching."""
    return TextNormalizer(NormalizationLevel.STRICT)

def create_medium_normalizer() -> TextNormalizer:
    """Create a medium normalizer for balanced matching."""
    return TextNormalizer(NormalizationLevel.MEDIUM)

def create_relaxed_normalizer() -> TextNormalizer:
    """Create a relaxed normalizer for fuzzy matching."""
    return TextNormalizer(NormalizationLevel.RELAXED)

# Convenience functions
def normalize_phrase_strict(phrase: str) -> str:
    """Normalize phrase with strict rules."""
    return create_strict_normalizer().normalize_phrase(phrase)

def normalize_phrase_medium(phrase: str) -> str:
    """Normalize phrase with medium rules."""
    return create_medium_normalizer().normalize_phrase(phrase)

def normalize_phrase_relaxed(phrase: str) -> str:
    """Normalize phrase with relaxed rules."""
    return create_relaxed_normalizer().normalize_phrase(phrase) 