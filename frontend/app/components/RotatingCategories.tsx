import React, { useState, useEffect } from 'react';

const RotatingCategories: React.FC = () => {
  const [currentPhrase, setCurrentPhrase] = useState('');

  // Define phrases based on market periods
  const getPhrasesForTime = () => {
    const hour = new Date().getHours();
    const day = new Date().getDay(); // 0 = Sunday, 6 = Saturday
    
    // Weekend phrases
    if (day === 0 || day === 6) {
      return [
        "Let's analyze the weekend moves",
        "Time to review market positions",
        "What's on your watchlist?",
        "Ready to dive into the data?"
      ];
    }
    
    // Pre-market (4 AM - 9:30 AM ET, using local time approximation)
    if (hour >= 4 && hour < 9) {
      return [
        "Let's check the pre-market",
        "Time for the morning briefing",
        "Let's see how the futures are moving",
        "Ready for the morning note?"
      ];
    }
    
    // Market hours (9:30 AM - 4 PM ET)
    if (hour >= 9 && hour < 16) {
      return [
        "Time to hit the charts",
        "Let's see how the markets are moving",
        "What's moving in the markets?",
        "Ready to analyze the action?"
      ];
    }
    
    // After-hours (4 PM - 8 PM ET)
    if (hour >= 16 && hour < 20) {
      return [
        "Time for the daily wrap",
        "Let's review today's moves",
        "What caught your attention today?",
        "Ready for post-market analysis?"
      ];
    }
    
    // Evening/Night
    return [
      "Planning tomorrow's trades?",
      "Time for some deep analysis",
      "What's on your radar?",
      "Ready to dive into the research?"
    ];
  };

  useEffect(() => {
    // Get phrases for current time period
    const phrases = getPhrasesForTime();
    
    // Get or create a session-based index for this time period
    const timeKey = `phrase_index_${Math.floor(new Date().getHours() / 4)}`; // Group hours into 6 periods
    let sessionIndex = parseInt(sessionStorage.getItem(timeKey) || '0');
    
    // If this is a new session or the stored index is invalid, pick a random starting point
    if (isNaN(sessionIndex) || sessionIndex >= phrases.length) {
      sessionIndex = Math.floor(Math.random() * phrases.length);
    }
    
    // Set the current phrase
    setCurrentPhrase(phrases[sessionIndex]);
    
    // Increment and store the index for next refresh
    const nextIndex = (sessionIndex + 1) % phrases.length;
    sessionStorage.setItem(timeKey, nextIndex.toString());
    
  }, []); // Only run once on component mount

  return (
    <div className="select-none">
      <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
        <span 
          className="transition-all duration-500 ease-in-out bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent"
        >
          {currentPhrase}
        </span>
      </h1>
    </div>
  );
};

export default RotatingCategories; 