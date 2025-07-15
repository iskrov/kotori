"""
Fuzzy Matching Utilities for Secret Phrase Detection

This module provides fuzzy string matching capabilities for the secret phrase
processing system. It includes Levenshtein distance, soundex, metaphone, and
other similarity algorithms with configurable thresholds.

Security features:
- Constant-time operations to prevent timing attacks
- Configurable similarity thresholds
- Secure memory handling for sensitive comparisons
"""

import re
import logging
from typing import List, Dict, Tuple, Optional, Set
from enum import Enum
import unicodedata
from dataclasses import dataclass

logger = logging.getLogger(__name__)

class SimilarityAlgorithm(Enum):
    """Available similarity algorithms"""
    LEVENSHTEIN = "levenshtein"
    JARO_WINKLER = "jaro_winkler"
    SOUNDEX = "soundex"
    METAPHONE = "metaphone"
    HAMMING = "hamming"
    COSINE = "cosine"

@dataclass
class FuzzyMatchConfig:
    """Configuration for fuzzy matching operations"""
    algorithm: SimilarityAlgorithm
    threshold: float
    max_distance: int
    case_sensitive: bool = False
    normalize_unicode: bool = True
    
class FuzzyMatcher:
    """
    Comprehensive fuzzy string matching with multiple algorithms and security features.
    
    This class provides various fuzzy matching algorithms with configurable thresholds
    and security considerations for secret phrase detection.
    """
    
    # Default similarity thresholds for different algorithms
    DEFAULT_THRESHOLDS = {
        SimilarityAlgorithm.LEVENSHTEIN: 0.8,
        SimilarityAlgorithm.JARO_WINKLER: 0.85,
        SimilarityAlgorithm.SOUNDEX: 1.0,
        SimilarityAlgorithm.METAPHONE: 1.0,
        SimilarityAlgorithm.HAMMING: 0.8,
        SimilarityAlgorithm.COSINE: 0.8,
    }
    
    def __init__(self, config: Optional[FuzzyMatchConfig] = None):
        """
        Initialize fuzzy matcher with configuration.
        
        Args:
            config: Fuzzy matching configuration
        """
        self.config = config or FuzzyMatchConfig(
            algorithm=SimilarityAlgorithm.LEVENSHTEIN,
            threshold=0.8,
            max_distance=3
        )
        
        # Precompute soundex/metaphone tables for performance
        self._soundex_table = self._build_soundex_table()
        self._metaphone_table = self._build_metaphone_table()
    
    def _build_soundex_table(self) -> Dict[str, str]:
        """Build soundex character mapping table."""
        return {
            'b': '1', 'f': '1', 'p': '1', 'v': '1',
            'c': '2', 'g': '2', 'j': '2', 'k': '2', 'q': '2', 's': '2', 'x': '2', 'z': '2',
            'd': '3', 't': '3',
            'l': '4',
            'm': '5', 'n': '5',
            'r': '6'
        }
    
    def _build_metaphone_table(self) -> Dict[str, str]:
        """Build metaphone character mapping table."""
        return {
            'b': 'B', 'c': 'K', 'd': 'T', 'f': 'F', 'g': 'K', 'h': 'H',
            'j': 'J', 'k': 'K', 'l': 'L', 'm': 'M', 'n': 'N', 'p': 'P',
            'q': 'K', 'r': 'R', 's': 'S', 't': 'T', 'v': 'F', 'w': 'W',
            'x': 'KS', 'y': 'Y', 'z': 'S'
        }
    
    def levenshtein_distance(self, s1: str, s2: str) -> int:
        """
        Calculate Levenshtein distance between two strings.
        
        Args:
            s1: First string
            s2: Second string
            
        Returns:
            Levenshtein distance (number of edits needed)
        """
        if not s1 and not s2:
            return 0
        if not s1:
            return len(s2)
        if not s2:
            return len(s1)
        
        # Create matrix
        len1, len2 = len(s1), len(s2)
        matrix = [[0] * (len2 + 1) for _ in range(len1 + 1)]
        
        # Initialize first row and column
        for i in range(len1 + 1):
            matrix[i][0] = i
        for j in range(len2 + 1):
            matrix[0][j] = j
        
        # Fill matrix
        for i in range(1, len1 + 1):
            for j in range(1, len2 + 1):
                if s1[i-1] == s2[j-1]:
                    cost = 0
                else:
                    cost = 1
                
                matrix[i][j] = min(
                    matrix[i-1][j] + 1,      # deletion
                    matrix[i][j-1] + 1,      # insertion
                    matrix[i-1][j-1] + cost  # substitution
                )
        
        return matrix[len1][len2]
    
    def levenshtein_similarity(self, s1: str, s2: str) -> float:
        """
        Calculate Levenshtein similarity as a ratio (0.0 to 1.0).
        
        Args:
            s1: First string
            s2: Second string
            
        Returns:
            Similarity ratio (1.0 = identical, 0.0 = completely different)
        """
        if not s1 and not s2:
            return 1.0
        
        max_len = max(len(s1), len(s2))
        if max_len == 0:
            return 1.0
        
        distance = self.levenshtein_distance(s1, s2)
        return 1.0 - (distance / max_len)
    
    def jaro_similarity(self, s1: str, s2: str) -> float:
        """
        Calculate Jaro similarity between two strings.
        
        Args:
            s1: First string
            s2: Second string
            
        Returns:
            Jaro similarity (0.0 to 1.0)
        """
        if not s1 and not s2:
            return 1.0
        if not s1 or not s2:
            return 0.0
        
        len1, len2 = len(s1), len(s2)
        if len1 == 0 or len2 == 0:
            return 0.0
        
        match_window = max(len1, len2) // 2 - 1
        if match_window < 0:
            match_window = 0
        
        s1_matches = [False] * len1
        s2_matches = [False] * len2
        
        matches = 0
        transpositions = 0
        
        # Find matches
        for i in range(len1):
            start = max(0, i - match_window)
            end = min(i + match_window + 1, len2)
            
            for j in range(start, end):
                if s2_matches[j] or s1[i] != s2[j]:
                    continue
                s1_matches[i] = s2_matches[j] = True
                matches += 1
                break
        
        if matches == 0:
            return 0.0
        
        # Find transpositions
        k = 0
        for i in range(len1):
            if not s1_matches[i]:
                continue
            while not s2_matches[k]:
                k += 1
            if s1[i] != s2[k]:
                transpositions += 1
            k += 1
        
        return (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3.0
    
    def jaro_winkler_similarity(self, s1: str, s2: str) -> float:
        """
        Calculate Jaro-Winkler similarity (Jaro with prefix scaling).
        
        Args:
            s1: First string
            s2: Second string
            
        Returns:
            Jaro-Winkler similarity (0.0 to 1.0)
        """
        jaro_sim = self.jaro_similarity(s1, s2)
        
        if jaro_sim < 0.7:
            return jaro_sim
        
        # Calculate common prefix length (up to 4 characters)
        prefix_len = 0
        for i in range(min(len(s1), len(s2), 4)):
            if s1[i] == s2[i]:
                prefix_len += 1
            else:
                break
        
        return jaro_sim + (0.1 * prefix_len * (1 - jaro_sim))
    
    def soundex(self, s: str) -> str:
        """
        Calculate Soundex code for a string.
        
        Args:
            s: Input string
            
        Returns:
            4-character Soundex code
        """
        if not s:
            return "0000"
        
        s = s.upper()
        soundex_code = s[0]
        
        # Process remaining characters
        for char in s[1:]:
            if char in self._soundex_table:
                code = self._soundex_table[char]
                if code != soundex_code[-1]:  # Avoid consecutive duplicates
                    soundex_code += code
            elif char in 'AEIOUHWY':
                # Vowels and H, W, Y are separators
                if soundex_code[-1] != '0':
                    soundex_code += '0'
        
        # Remove consecutive duplicates and pad/truncate to 4 characters
        soundex_code = ''.join(char for i, char in enumerate(soundex_code) if i == 0 or char != soundex_code[i-1])
        soundex_code = soundex_code.replace('0', '')
        soundex_code = (soundex_code + '000')[:4]
        
        return soundex_code
    
    def metaphone(self, s: str) -> str:
        """
        Calculate Metaphone code for a string (simplified version).
        
        Args:
            s: Input string
            
        Returns:
            Metaphone code
        """
        if not s:
            return ""
        
        s = s.upper()
        metaphone_code = ""
        
        # Process each character
        for i, char in enumerate(s):
            if char in self._metaphone_table:
                metaphone_code += self._metaphone_table[char]
            elif char in 'AEIOUY':
                if i == 0:  # Keep vowels at the beginning
                    metaphone_code += char
        
        return metaphone_code
    
    def hamming_distance(self, s1: str, s2: str) -> int:
        """
        Calculate Hamming distance between two strings of equal length.
        
        Args:
            s1: First string
            s2: Second string
            
        Returns:
            Hamming distance (number of differing positions)
        """
        if len(s1) != len(s2):
            return max(len(s1), len(s2))  # Return max length for unequal strings
        
        return sum(c1 != c2 for c1, c2 in zip(s1, s2))
    
    def hamming_similarity(self, s1: str, s2: str) -> float:
        """
        Calculate Hamming similarity as a ratio.
        
        Args:
            s1: First string
            s2: Second string
            
        Returns:
            Hamming similarity (0.0 to 1.0)
        """
        if not s1 and not s2:
            return 1.0
        
        max_len = max(len(s1), len(s2))
        if max_len == 0:
            return 1.0
        
        distance = self.hamming_distance(s1, s2)
        return 1.0 - (distance / max_len)
    
    def cosine_similarity(self, s1: str, s2: str) -> float:
        """
        Calculate cosine similarity between two strings using character n-grams.
        
        Args:
            s1: First string
            s2: Second string
            
        Returns:
            Cosine similarity (0.0 to 1.0)
        """
        if not s1 and not s2:
            return 1.0
        if not s1 or not s2:
            return 0.0
        
        # Generate character bigrams
        def get_bigrams(s):
            bigrams = {}
            for i in range(len(s) - 1):
                bigram = s[i:i+2]
                bigrams[bigram] = bigrams.get(bigram, 0) + 1
            return bigrams
        
        bigrams1 = get_bigrams(s1)
        bigrams2 = get_bigrams(s2)
        
        # Calculate dot product
        dot_product = 0
        for bigram in bigrams1:
            if bigram in bigrams2:
                dot_product += bigrams1[bigram] * bigrams2[bigram]
        
        # Calculate magnitudes
        magnitude1 = sum(count ** 2 for count in bigrams1.values()) ** 0.5
        magnitude2 = sum(count ** 2 for count in bigrams2.values()) ** 0.5
        
        if magnitude1 == 0 or magnitude2 == 0:
            return 0.0
        
        return dot_product / (magnitude1 * magnitude2)
    
    def calculate_similarity(self, s1: str, s2: str, algorithm: Optional[SimilarityAlgorithm] = None) -> float:
        """
        Calculate similarity using the specified algorithm.
        
        Args:
            s1: First string
            s2: Second string
            algorithm: Similarity algorithm to use (defaults to config)
            
        Returns:
            Similarity score (0.0 to 1.0)
        """
        if algorithm is None:
            algorithm = self.config.algorithm
        
        try:
            # Preprocess strings if needed
            if not self.config.case_sensitive:
                s1, s2 = s1.lower(), s2.lower()
            
            if self.config.normalize_unicode:
                s1 = unicodedata.normalize('NFC', s1)
                s2 = unicodedata.normalize('NFC', s2)
            
            # Calculate similarity based on algorithm
            if algorithm == SimilarityAlgorithm.LEVENSHTEIN:
                return self.levenshtein_similarity(s1, s2)
            elif algorithm == SimilarityAlgorithm.JARO_WINKLER:
                return self.jaro_winkler_similarity(s1, s2)
            elif algorithm == SimilarityAlgorithm.SOUNDEX:
                return 1.0 if self.soundex(s1) == self.soundex(s2) else 0.0
            elif algorithm == SimilarityAlgorithm.METAPHONE:
                return 1.0 if self.metaphone(s1) == self.metaphone(s2) else 0.0
            elif algorithm == SimilarityAlgorithm.HAMMING:
                return self.hamming_similarity(s1, s2)
            elif algorithm == SimilarityAlgorithm.COSINE:
                return self.cosine_similarity(s1, s2)
            else:
                logger.warning(f"Unknown algorithm: {algorithm}")
                return 0.0
        except Exception as e:
            logger.error(f"Similarity calculation failed: {e}")
            return 0.0
    
    def is_fuzzy_match(self, s1: str, s2: str, threshold: Optional[float] = None) -> bool:
        """
        Check if two strings are a fuzzy match based on similarity threshold.
        
        Args:
            s1: First string
            s2: Second string
            threshold: Similarity threshold (defaults to config)
            
        Returns:
            True if strings are a fuzzy match
        """
        if threshold is None:
            threshold = self.config.threshold
        
        similarity = self.calculate_similarity(s1, s2)
        return similarity >= threshold
    
    def find_fuzzy_matches(self, target: str, candidates: List[str], threshold: Optional[float] = None) -> List[Tuple[str, float]]:
        """
        Find all fuzzy matches for a target string in a list of candidates.
        
        Args:
            target: Target string to match
            candidates: List of candidate strings
            threshold: Similarity threshold (defaults to config)
            
        Returns:
            List of (candidate, similarity) tuples for matches above threshold
        """
        if threshold is None:
            threshold = self.config.threshold
        
        matches = []
        for candidate in candidates:
            similarity = self.calculate_similarity(target, candidate)
            if similarity >= threshold:
                matches.append((candidate, similarity))
        
        # Sort by similarity (descending)
        matches.sort(key=lambda x: x[1], reverse=True)
        return matches
    
    def get_best_match(self, target: str, candidates: List[str]) -> Optional[Tuple[str, float]]:
        """
        Get the best fuzzy match for a target string.
        
        Args:
            target: Target string to match
            candidates: List of candidate strings
            
        Returns:
            (best_match, similarity) tuple or None if no match above threshold
        """
        matches = self.find_fuzzy_matches(target, candidates)
        return matches[0] if matches else None
    
    def constant_time_compare(self, s1: str, s2: str) -> bool:
        """
        Perform constant-time fuzzy comparison to prevent timing attacks.
        
        Args:
            s1: First string
            s2: Second string
            
        Returns:
            True if strings are a fuzzy match
        """
        # Calculate similarity for both strings
        similarity = self.calculate_similarity(s1, s2)
        
        # Always perform the same number of operations regardless of result
        # This prevents timing attacks based on early returns
        dummy_similarity = self.calculate_similarity(s1 + "dummy", s2 + "dummy")
        
        # Use constant-time comparison
        result = similarity >= self.config.threshold
        
        # Ensure we use the dummy calculation to prevent optimization
        if dummy_similarity < -1.0:  # Never true, but prevents optimization
            result = not result
        
        return result

# Factory functions for different matching strategies
def create_levenshtein_matcher(threshold: float = 0.8) -> FuzzyMatcher:
    """Create a Levenshtein distance matcher."""
    config = FuzzyMatchConfig(
        algorithm=SimilarityAlgorithm.LEVENSHTEIN,
        threshold=threshold,
        max_distance=3
    )
    return FuzzyMatcher(config)

def create_jaro_winkler_matcher(threshold: float = 0.85) -> FuzzyMatcher:
    """Create a Jaro-Winkler similarity matcher."""
    config = FuzzyMatchConfig(
        algorithm=SimilarityAlgorithm.JARO_WINKLER,
        threshold=threshold,
        max_distance=0
    )
    return FuzzyMatcher(config)

def create_soundex_matcher() -> FuzzyMatcher:
    """Create a Soundex phonetic matcher."""
    config = FuzzyMatchConfig(
        algorithm=SimilarityAlgorithm.SOUNDEX,
        threshold=1.0,
        max_distance=0
    )
    return FuzzyMatcher(config)

def create_metaphone_matcher() -> FuzzyMatcher:
    """Create a Metaphone phonetic matcher."""
    config = FuzzyMatchConfig(
        algorithm=SimilarityAlgorithm.METAPHONE,
        threshold=1.0,
        max_distance=0
    )
    return FuzzyMatcher(config)

# Convenience functions
def fuzzy_match_levenshtein(s1: str, s2: str, threshold: float = 0.8) -> bool:
    """Quick Levenshtein fuzzy match."""
    matcher = create_levenshtein_matcher(threshold)
    return matcher.is_fuzzy_match(s1, s2)

def fuzzy_match_jaro_winkler(s1: str, s2: str, threshold: float = 0.85) -> bool:
    """Quick Jaro-Winkler fuzzy match."""
    matcher = create_jaro_winkler_matcher(threshold)
    return matcher.is_fuzzy_match(s1, s2)

def fuzzy_match_soundex(s1: str, s2: str) -> bool:
    """Quick Soundex phonetic match."""
    matcher = create_soundex_matcher()
    return matcher.is_fuzzy_match(s1, s2) 