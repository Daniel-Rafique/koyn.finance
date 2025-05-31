import React, { useState, useEffect, useRef } from 'react';

// Clean, minimal styles focused on complementing the site
const popoverStyles = `
  @keyframes fadeIn {
    from { 
      opacity: 0; 
      transform: translate(-50%, -95%);
    }
    to { 
      opacity: 1; 
      transform: translate(-50%, -100%);
    }
  }
  
  .popover-content a {
    color: #ffffff;
    text-decoration: none;
  }
  
  .popover-content a:hover {
    text-decoration: underline;
  }
  
  .tweet-popover {
    position: fixed;
    z-index: 9999;
    background-color: #000000;
    border: 1px solid rgba(255, 255, 255, 0.5);
    border-radius: 0.5rem;
    padding: 1rem;
    width: 24rem;
    left: 50%;
    transform: translate(-50%, -100%);
    box-shadow: 0 10px 25px -5px rgba(255, 255, 255, 0.3), 0 8px 10px -6px rgba(255, 255, 255, 0.2);
    animation: fadeIn 0.15s ease-out;
    backdrop-filter: blur(4px);
    margin-top: -15px;
    will-change: transform, opacity;
  }
  
  .news-carousel {
    position: relative;
    z-index: 50;
    border-top: 1px solid rgba(255, 255, 255, 0.2);
  }
  
  .news-content {
    white-space: nowrap;
    max-width: 70vw;
    display: inline-block;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .carousel-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    transition: all 0.3s ease;
  }
  
  .carousel-dot.active {
    background-color: white;
  }
  
  .carousel-dot.inactive {
    background-color: rgba(255, 255, 255, 0.3);
  }
  
  .carousel-dot:hover {
    background-color: rgba(255, 255, 255, 0.7);
  }
  
  .popover-arrow {
    position: absolute;
    width: 16px;
    height: 16px;
    background-color: #000000;
    border-right: 1px solid rgba(255, 255, 255, 0.5);
    border-bottom: 1px solid rgba(255, 255, 255, 0.5);
    bottom: -8px;
    left: 50%;
    transform: translateX(-50%) rotate(45deg);
  }
  
  .carousel-item {
    transition: opacity 1000ms;
  }
`;

interface Tweet {
  title: string;
  creator: string;
  description: string;
  pubDate: string;
  guid: string;
  link: string;
  profileImage?: string;
  profileName?: string;
  accountId?: string;
}

interface ProfileData {
  metadata: {
    title: string;
    image: {
      url: string;
    };
  };
  items: Tweet[];
}

interface NewsCarouselProps {
  accounts: string[];
}

// Add fallback tweets for when we can't fetch real tweets
const FALLBACK_TWEETS = [
  {
    guid: 'fallback-1',
    creator: 'koynlabs',
    profileName: 'Koynlabs',
    description: 'Check out the latest updates on crypto markets and trends!',
    pubDate: new Date().toISOString(),
    link: 'https://koyn.finance/koynlabs',
    profileImage: '/logo.jpg'
  },
  {
    guid: 'fallback-2',
    creator: 'crypto',
    profileName: 'Crypto',
    description: 'Markets are showing positive signs as tech stocks rally.',
    pubDate: new Date().toISOString(),
    link: 'https://koyn.finance/crypto',
    profileImage: '/logo.jpg'
  },
  {
    guid: 'fallback-3',
    creator: 'markets',
    profileName: 'Markets',
    description: 'Markets are showing positive signs as tech stocks rally.',
    pubDate: new Date().toISOString(),
    link: 'https://koyn.finance/markets',
    profileImage: '/logo.jpg'
  },
  {
    guid: 'fallback-4',
    creator: 'solana',
    profileName: 'Solana',
    description: 'Solana ecosystem grows with new DeFi and NFT projects launching this week.',
    pubDate: new Date().toISOString(),
    link: 'https://koyn.finance/solana',
    profileImage: '/logo.jpg'
  }
];

export default function NewsCarousel({ accounts }: NewsCarouselProps) {
  const [profilesData, setProfilesData] = useState<Record<string, ProfileData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTweetIndex, setCurrentTweetIndex] = useState(0);
  const [activeTweets, setActiveTweets] = useState<Tweet[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [hoveredTweet, setHoveredTweet] = useState<Tweet | null>(null);
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });
  const cacheTimeRef = useRef<Record<string, number>>({});
  const rotationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const isBrowser = useRef(typeof window !== 'undefined');

  const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

  // Add useEffect to inject styles once when component mounts
  useEffect(() => {
    if (!isBrowser.current) return;
    
    // Check if the style element already exists to avoid duplicates
    const styleId = 'news-carousel-styles';
    if (!document.getElementById(styleId)) {
      const styleElement = document.createElement('style');
      styleElement.id = styleId;
      styleElement.innerHTML = popoverStyles;
      document.head.appendChild(styleElement);
      
      // Clean up on unmount
      return () => {
        const styleToRemove = document.getElementById(styleId);
        if (styleToRemove) {
          document.head.removeChild(styleToRemove);
        }
      };
    }
  }, []);

  // Close popover when clicking outside
  useEffect(() => {
    if (!isBrowser.current) return;
    
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setHoveredTweet(null);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Update popover position when carousel state changes
  useEffect(() => {
    if (!isBrowser.current || !hoveredTweet) return;
    
    // Calculate position based on the carousel container
    const carouselContainer = document.querySelector('.news-carousel .container');
    let centerX = window.innerWidth / 2;
    
    if (carouselContainer) {
      const rect = carouselContainer.getBoundingClientRect();
      centerX = rect.left + (rect.width / 2);
    }
    
    // Use the ticker's vertical position
    const tickerTop = document.querySelector('.news-carousel')?.getBoundingClientRect().top || 0;
    
    setPopoverPosition({
      top: tickerTop - 15,
      left: centerX
    });
  }, [hoveredTweet]);

  // Reset hoveredTweet when currentTweetIndex changes
  useEffect(() => {
    setHoveredTweet(null);
  }, [currentTweetIndex]);

  // Fetch profile data for each account
  useEffect(() => {
    const fetchProfiles = async () => {
      setLoading(true);
      setError(null);
      
      const newProfilesData: Record<string, ProfileData> = {};
      const currentTime = new Date().getTime();
      let fetchError = false;
      
      // Always fetch fresh data for development debugging
      const forceRefresh = process.env.NODE_ENV === 'development';
      
      for (const account of accounts) {
        try {
          // Check if we have cached data that's still valid (but skip cache in development)
          if (
            !forceRefresh &&
            profilesData[account] && 
            cacheTimeRef.current[account] && 
            (currentTime - cacheTimeRef.current[account]) < CACHE_DURATION
          ) {
            newProfilesData[account] = profilesData[account];
            console.log(`Using cached data for ${account}`);
            continue;
          }
          
          console.log(`Fetching fresh data for ${account}`);
          
          // Prepare authentication headers
          const authHeaders: Record<string, string> = {
            'Content-Type': 'application/json'
          };
          
          // Get JWT token from localStorage (new authentication method)
          let jwtToken = null;
          try {
            const subscriptionData = localStorage.getItem('koyn_subscription');
            if (subscriptionData) {
              const parsed = JSON.parse(subscriptionData);
              jwtToken = parsed.token || null;
              if (jwtToken) {
                authHeaders['Authorization'] = `Bearer ${jwtToken}`;
                console.log('Using JWT token authentication for profile request');
              }
            }
          } catch (error) {
            console.warn('Error reading JWT token from localStorage:', error);
          }
          
          // Fallback to legacy subscription ID if no JWT token
          if (!jwtToken) {
            let subscriptionId = null;
            try {
              const subscriptionData = localStorage.getItem('koyn_subscription');
              if (subscriptionData) {
                const parsed = JSON.parse(subscriptionData);
                subscriptionId = parsed.id || null;
              }
            } catch (error) {
              console.warn('Error reading subscription data from localStorage:', error);
            }
            
            if (subscriptionId) {
              console.log('Using legacy subscription ID for profile request');
            } else {
              console.log('No authentication available, using general profile access');
            }
          }

          // API endpoint URL - use same domain for live server, localhost:3001 for development
          const apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? `${window.location.protocol}//${window.location.hostname}:3001/api/profiles`
            : `${window.location.protocol}//${window.location.hostname}:3001/api/profiles`;
            
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ 
              profileId: account,
              _timestamp: Date.now()
            }),
          });
          
          if (!response.ok) {
            console.error(`Error response for ${account}:`, response.status);
            fetchError = true;
            continue;
          }
          
          const data = await response.json();
          
          if (data.status.code === 200 && data.data) {
            newProfilesData[account] = data.data;
            cacheTimeRef.current[account] = currentTime;
            console.log(`Successfully fetched data for ${account}, got ${data.data.items.length} tweets`);
          } else {
            console.error(`Invalid data for ${account}:`, data);
            fetchError = true;
          }
        } catch (err) {
          console.error(`Error fetching profile for ${account}:`, err);
          fetchError = true;
        }
      }
      
      // Check if we have any data - if not, use fallbacks
      const useFallbacks = Object.keys(newProfilesData).length === 0;
      
      if (useFallbacks) {
        console.log('No data available, using fallback tweets');
        
        // Create a synthetic data structure using fallbacks
        const fallbackAccountData = accounts.reduce((acc, account, index) => {
          // Find a fallback tweet for this account or use a generic one
          const fallbackTweet = FALLBACK_TWEETS.find(t => t.creator.toLowerCase() === account.toLowerCase()) || 
                                FALLBACK_TWEETS[index % FALLBACK_TWEETS.length];
          
          acc[account] = {
            metadata: {
              title: fallbackTweet.profileName + ' / @' + fallbackTweet.creator,
              image: {
                url: fallbackTweet.profileImage
              }
            },
            items: [
              {
                ...fallbackTweet,
                title: fallbackTweet.profileName,
                creator: fallbackTweet.creator
              }
            ]
          };
          
          return acc;
        }, {} as Record<string, ProfileData>);
        
        setProfilesData(fallbackAccountData);
        
        // Create a merged list of all fallback tweets
        const fallbackTweets = Object.entries(fallbackAccountData).map(([accountId, profile]) => ({
          ...profile.items[0],
          profileImage: profile.metadata.image.url,
          profileName: profile.metadata.title.split(' / @')[0] || profile.metadata.title,
          accountId: accountId
        }));
        
        setActiveTweets(fallbackTweets);
        setLoading(false);
        setError(fetchError ? "Using demo data due to connection issues" : null);
        return;
      }
      
      setProfilesData(newProfilesData);
      setLoading(false);
      
      // Create a merged list of all tweets from all accounts
      const allTweets = Object.entries(newProfilesData).flatMap(([accountId, profile]) => 
        profile.items.map(tweet => ({
          ...tweet,
          profileImage: profile.metadata.image.url,
          profileName: profile.metadata.title.split(' / @')[0] || profile.metadata.title,
          accountId: accountId
        }))
      );
      
      console.log(`Total tweets collected: ${allTweets.length}`);
      
      // Sort tweets by date (newest first)
      allTweets.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
      
      // Debug output of collected tweets
      allTweets.forEach((tweet, index) => {
        if (index < 5) { // Just log the first 5 for debugging
          console.log(`Tweet ${index+1}: @${tweet.accountId} - ${new Date(tweet.pubDate).toLocaleDateString()}`);
        }
      });
      
      setActiveTweets(allTweets);
    };
    
    fetchProfiles();
    
    // Set up a refresh interval
    const refreshInterval = setInterval(fetchProfiles, 15 * 60 * 1000); // Refresh every 15 minutes
    
    // Clean up timer on unmount
    return () => {
      if (rotationTimerRef.current) {
        clearInterval(rotationTimerRef.current);
      }
      clearInterval(refreshInterval);
    };
  }, [accounts]);
  
  // Control the rotation timer
  useEffect(() => {
    // Clear any existing timer
    if (rotationTimerRef.current) {
      clearInterval(rotationTimerRef.current);
      rotationTimerRef.current = null;
    }
    
    // Only set a new timer if not paused, we have tweets, and there's no active hoveredTweet
    if (!isPaused && activeTweets.length > 0 && !hoveredTweet) {
      rotationTimerRef.current = setInterval(() => {
        setCurrentTweetIndex(prevIndex => {
          const nextIndex = prevIndex + 1;
          return nextIndex >= activeTweets.length ? 0 : nextIndex;
        });
      }, 8000); // Rotate every 8 seconds
    }
    
    // Clean up timer on unmount or when dependencies change
    return () => {
      if (rotationTimerRef.current) {
        clearInterval(rotationTimerRef.current);
      }
    };
  }, [isPaused, activeTweets.length, hoveredTweet]);
  
  // Final enhancement for Tweet content cleaning
  const cleanHtmlContent = (html: string): string => {
    // Server-side rendering safe method
    if (!isBrowser.current) {
      // Simple regex-based HTML tag removal for server-side
      return html
        .replace(/<[^>]*>?/gm, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .trim();
    }
    
    // Client-side method using DOM
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    let text = tempDiv.textContent || tempDiv.innerText || '';
    
    // Further clean the text for ticker display
    text = text
      .replace(/\s+/g, ' ')        // Replace multiple spaces with a single space
      .replace(/\n/g, ' ')         // Replace newlines with spaces
      .replace(/^RT\s+/i, '')      // Remove "RT" at the start (retweets)
      .replace(/\s+via\s+.+$/i, '') // Remove "via @username" at the end
      .trim();
      
    return text;
  };
  
  // Format the tweet description by cleaning up HTML
  const formatDescription = (description: string, fullVersion = false) => {
    // For ticker display, completely clean HTML
    if (!fullVersion) {
      return cleanHtmlContent(description);
    }
    
    // For popover, preserve formatting but clean up problematic tags
    let formattedDesc = description
      // Fix broken paragraph tags
      .replace(/<p>\s*<\/p>/g, '')
      // Make hashtags colored
      .replace(/<span class="hashtag">(#\w+)<\/span>/g, '<span style="color: #b050a0">$1</span>')
      // Style links properly with nofollow and other SEO attributes
      .replace(/<a href="([^"]+)"[^>]*>/g, '<a href="$1" target="_blank" rel="noopener noreferrer nofollow" style="color: #b050a0; text-decoration: none;">')
      // Fix any malformed HTML
      .replace(/<span class="hashtag">#([^<]+)<\/a>/g, '<span style="color: #b050a0">#$1</span>')
      // Fix line breaks if needed
      .replace(/\n/g, '<br>');
    
    return formattedDesc;
  };
  
  // Format the date to a friendly format
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };
  
  // Fix potentially broken image URLs
  const fixImageUrl = (url: string | undefined) => {
    if (!url) return '/logo.jpg'; // Default image if none provided
    
    // If the URL is already absolute and not a koyn.finance URL, use it directly
    if (url.startsWith('http') && !url.includes('koyn.finance/pic/')) {
      return url;
    }
    
    // Extract the actual URL from koyn.finance/pic/ format
    if (url.includes('koyn.finance/pic/')) {
      try {
        // Extract the encoded URL part
        const encodedUrl = url.split('koyn.finance/pic/')[1];
        // Some URLs might be double encoded
        const decodedUrl = decodeURIComponent(encodedUrl);
        
        // If it looks like another koyn.finance URL, return default
        if (decodedUrl.includes('koyn.finance')) {
          return '/logo.jpg';
        }
        
        // If it's a Twitter URL, try to format it correctly
        if (decodedUrl.includes('pbs.twimg.com')) {
          return `https://${decodedUrl.replace(/https?:\/\//, '')}`;
        }
        
        return `https://${decodedUrl}`;
      } catch (e) {
        return '/logo.jpg';
      }
    }
    
    return url;
  };

  // Convert koyn.finance tweet links to x.com format and ensure proper SEO
  const convertToXLink = (link: string): string => {
    // Server already handles conversion via Nitter config
    return link;
  };

  // Helper function to generate the proper rel attribute for links
  const getLinkRel = () => {
    return "noopener noreferrer nofollow";
  };
  
  // Add metadata for search engines
  useEffect(() => {
    if (!isBrowser.current) return;
    
    // Create a meta tag for robots to prevent indexing of carousel content
    const robotsMeta = document.createElement('meta');
    robotsMeta.name = 'robots';
    robotsMeta.content = 'noindex, nofollow';
    
    // Create a unique ID for this meta tag
    robotsMeta.id = 'news-carousel-robots-meta';
    
    // Only add if not already present
    if (!document.getElementById('news-carousel-robots-meta')) {
      document.head.appendChild(robotsMeta);
    }
    
    return () => {
      // Clean up on unmount
      const metaTag = document.getElementById('news-carousel-robots-meta');
      if (metaTag) {
        document.head.removeChild(metaTag);
      }
    };
  }, []);

  if (error && Object.keys(profilesData).length === 0) {
    return null; // Don't show anything if there's an error
  }
  
  if (activeTweets.length === 0) {
    return null; // Don't show anything if there are no tweets
  }
  
  return (
    <div className="news-carousel py-2" data-content-source="aggregated" data-indexable="false">
      <div 
        className="container mx-auto flex items-center relative px-4"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => {
          setIsPaused(false);
          
          if (isBrowser.current) {
            setTimeout(() => {
              if (popoverRef.current && !popoverRef.current.matches(':hover')) {
                setHoveredTweet(null);
              }
            }, 100);
          }
        }}
      >
        <div className="mr-4 text-white text-xs font-semibold uppercase tracking-wider opacity-80 whitespace-nowrap">
          LATEST NEWS
        </div>
        
        <div className="relative h-6 flex-grow overflow-hidden">
          {activeTweets.length > 0 ? (
            activeTweets.map((tweet, index) => (
              <div 
                key={tweet.guid} 
                className={`absolute top-0 left-0 w-full carousel-item ${
                  index === currentTweetIndex ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
                data-tweet-id={tweet.guid}
                data-aggregated-content="true"
                data-original-source={tweet.creator}
              >
                <div 
                  className="flex items-center cursor-pointer hover:text-white group"
                  onMouseEnter={() => {
                    if (index === currentTweetIndex) {
                      setHoveredTweet(tweet);
                    }
                  }}
                  onClick={() => {
                    if (index === currentTweetIndex) {
                      setHoveredTweet(tweet);
                    }
                  }}
                >
                  <div className="flex-shrink-0">
                    <img 
                      src={fixImageUrl(tweet.profileImage)} 
                      alt={tweet.creator} 
                      className="w-5 h-5 rounded-full mr-2"
                      onError={(e) => {
                        e.currentTarget.src = '/logo.jpg';
                      }}
                    />
                  </div>
                  <span className="text-white text-opacity-90 text-xs mr-2 group-hover:text-opacity-100 flex-shrink-0">
                    @{tweet.creator.replace('@', '')}
                  </span>
                  <span className="text-white text-opacity-80 text-xs group-hover:text-opacity-100 news-content">
                    {formatDescription(tweet.description)}
                  </span>
                </div>
              </div>
            ))
          ) : loading ? (
            <div className="text-white text-opacity-60 text-xs">Loading tweets...</div>
          ) : (
            <div className="text-white text-opacity-60 text-xs">No tweets available</div>
          )}
        </div>
        
        {/* Carousel indicators */}
        <div className="ml-4 flex space-x-2 flex-shrink-0">
          {activeTweets.slice(0, 5).map((_, index) => (
            <div 
              key={index} 
              className={`carousel-dot ${
                index === currentTweetIndex % 5 ? 'active' : 'inactive'
              }`}
              onClick={() => setCurrentTweetIndex(index + (Math.floor(currentTweetIndex / 5) * 5))}
              style={{ cursor: 'pointer' }}
            />
          ))}
        </div>
      </div>
      
      {/* Tweet Popover - Uses hoveredTweet directly */}
      {hoveredTweet && isBrowser.current && (
        <div
          ref={popoverRef}
          className="tweet-popover"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => {
            setIsPaused(false);
            setHoveredTweet(null);
          }}
          style={{
            top: `${popoverPosition.top}px`,
            left: `${popoverPosition.left}px`
          }}
          data-aggregated-content="true"
          data-indexable="false"
        >
          <div className="popover-arrow"></div>
          
          <div className="flex items-start mb-3">
            <img 
              src={fixImageUrl(hoveredTweet.profileImage)} 
              alt={hoveredTweet.creator} 
              className="w-10 h-10 rounded-full mr-3 flex-shrink-0 object-cover"
              onError={(e) => {
                e.currentTarget.src = '/logo.jpg';
              }}
            />
            <div>
              <div className="text-white font-medium">{hoveredTweet.profileName || hoveredTweet.creator}</div>
              <div className="text-white text-opacity-60 text-xs">@{hoveredTweet.creator.replace('@', '')}</div>
            </div>
            <button 
              className="ml-auto text-white text-opacity-50 hover:text-opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                setHoveredTweet(null);
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div 
            className="text-white text-sm mb-3 popover-content overflow-auto"
            style={{ maxHeight: '40vh', wordBreak: 'break-word' }}
            dangerouslySetInnerHTML={{ __html: formatDescription(hoveredTweet.description, true) }} 
          />
          
          <div className="flex justify-between items-center text-xs text-white text-opacity-60">
            <div>{formatDate(hoveredTweet.pubDate)}</div>
            <a 
              href={convertToXLink(hoveredTweet.link)} 
              target="_blank" 
              rel={getLinkRel()}
              className="text-[#b050a0] hover:underline transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              Read More
            </a>
          </div>
        </div>
      )}
    </div>
  );
}