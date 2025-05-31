import React, { useEffect, useRef } from 'react';
import { useSubscription } from '../context/AuthProvider';
import LightweightChart from './LightweightChart';

interface NewsItem {
  source: string;
  url: string;
  title: string;
  description?: string;
  publishedAt?: string;
}

interface AnalysisResult {
  asset: {
    name: string;
    symbol: string;
    type: string;
    price: string;
  };
  asset_price: string;
  chart: any;
  social_sentiment: string;
  analysis: string;
  price_change_percentage: number;
  actions: {
    can_save: boolean;
    can_share: boolean;
    result_id: string;
    saved: boolean;
  };
  ui_options: {
    show_save_button: boolean;
    show_share_button: boolean;
    save_button_text: string;
    share_button_text: string;
    save_button_icon: string;
    share_button_icon: string;
  };
  news?: NewsItem[];
  current_price?: {
    price: number;
    change: number;
    changesPercentage: number;
    dayHigh: number;
    dayLow: number;
    timestamp: number;
    source: string;
  };
}

interface AnalysisResultsProps {
  result: AnalysisResult;
  onSubscribeClick: () => void;
  news?: NewsItem[];
}

const AnalysisResults: React.FC<AnalysisResultsProps> = ({ result, onSubscribeClick, news }) => {
  // Handle subscription context safely - it might not be available on shared pages
  let subscriptionStatus = 'inactive';
  let userEmail = null;
  try {
    const subscription = useSubscription();
    subscriptionStatus = subscription.isSubscribed ? 'active' : 'inactive';
    userEmail = subscription.userEmail;
  } catch (error) {
    console.log('Subscription context not available, using defaults');
  }
  
  const isSubscribed = subscriptionStatus === 'active';
  const analysisRef = useRef<HTMLDivElement>(null);

  // Debug news data availability
  useEffect(() => {
    const resultNews = result.news || [];
    const propsNews = news || [];
    console.log('News data in AnalysisResults:',  {
      'From result prop': resultNews.length > 0 ? `${resultNews.length} items` : 'None',
      'From news prop': propsNews.length > 0 ? `${propsNews.length} items` : 'None',
      'Total available': (resultNews.length + propsNews.length) > 0 ? 'Yes' : 'No'
    });
  }, [result, news]);

  // Process analysis content to add tooltips to article tags
  const processAnalysisContent = () => {
    // Handle case where analysis might be undefined or null
    if (!result.analysis) {
      return '';
    }

    try {
      let processedAnalysis = result.analysis;

      // Known news sources
      const newsSources = [
        'Barron\'s', 'Investor\'s Business Daily', 'MarketWatch', 'Bloomberg', 'CNBC', 
        'Wall Street Journal', 'Financial Times', 'Reuters', 'CoinDesk', 'CoinTelegraph'
      ];

      // Get news items either from result object or from props
      const newsItems = result.news || news || [];

      // Process each news source
      newsSources.forEach(source => {
        const sourceRegex = new RegExp(`\\[${source}\\]`, 'g');

        processedAnalysis = processedAnalysis.replace(sourceRegex, (match) => {
          // Find matching news item for this source
          const matchingNews = newsItems.find(item => 
              item.source.toLowerCase() === source.toLowerCase() ||
              source.toLowerCase().includes(item.source.toLowerCase()) ||
            item.source.toLowerCase().includes(source.toLowerCase())
          );

          if (matchingNews) {
            return `<span class="article-tag">${source}<div class="tooltip-content">
              <h4 class="font-medium text-white mb-1">${matchingNews.title}</h4>
              <p class="text-xs text-[#a099d8] mb-2">${matchingNews.description || 'No description available'}</p>
              <a href="${matchingNews.url}" target="_blank" rel="noopener noreferrer" class="text-xs bg-[rgb(13,10,33)] text-[#95D5B2] px-3 py-1 rounded hover:bg-[rgb(19,15,47)] transition-colors inline-block">Read article</a>
            </div></span>`;
          }

          // If no matching news, return just the source name without a tooltip
          return `<span class="article-tag">${source}</span>`;
        });
      });

      // Also look for any remaining source tags that weren't processed
      const genericSourceRegex = /\[([\w\s']+)\]/g;
      processedAnalysis = processedAnalysis.replace(genericSourceRegex, (match, sourceName) => {
        return `<span class="article-tag">${sourceName}</span>`;
      });

      // Format sentiment analysis sections
      processedAnalysis = formatSentimentAnalysisSections(processedAnalysis);

      // Clean up any special characters or formatting artifacts
      processedAnalysis = processedAnalysis
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'")
        .replace(/\\n/g, '<br>')
        .replace(/\\t/g, '    ');

      // Clean up any presentation artifacts that may appear from different APIs
      processedAnalysis = processedAnalysis
        .replace(/">/g, '">')
        .replace(/\\>/g, '>')
        .replace(/->/g, '->')
        .replace(/> /g, '> ');

      // First thoroughly clean up any existing Twitter handle formatting that might be causing problems
      processedAnalysis = processedAnalysis
        .replace(/<a[^>]*>@([A-Za-z0-9_]+)(\d+)?<\/a>/g, '@$1$2')
        .replace(/<a[^>]*>@([A-Za-z0-9_]+)(\d+)?:<\/a>/g, '@$1$2:')
        .replace(/&#(?:x[0-9a-f]+|[0-9]+);/gi, '') // Remove HTML entities
        .replace(/[^\x20-\x7E]/g, '') // Remove non-ASCII characters
        .replace(/(@[A-Za-z0-9_]+)\\n/g, '$1 ') // Fix escaped newlines after handles
        .replace(/(@[A-Za-z0-9_]+)\\r/g, '$1 ') // Fix escaped returns after handles
        .replace(/(@[A-Za-z0-9_]+)[\\\/]{1,2}([a-zA-Z])/g, '$1 $2'); // Fix escaped slashes

      // Process Twitter usernames (format: @username with or without colon)
      // Break it into two passes to avoid nested HTML issues

      // First pass: handle @username: format (with colon)
      const twitterUserPatternWithColon = /@([A-Za-z0-9_]+[A-Za-z0-9_]*):(?!\S)/g;
      processedAnalysis = processedAnalysis.replace(twitterUserPatternWithColon, (match, username) => {
        // Clean the username of any remaining special characters
        username = username.replace(/[^A-Za-z0-9_]/g, '');

        // Create a link to the user's profile but keep the colon
        return `<a href="https://koyn.finance/${username}" 
                   class="twitter-username-post" 
                   target="_blank" 
                   rel="noopener noreferrer"
                   title="View posts by @${username}">@${username}</a>:`;
      });

      // Second pass: handle standalone @username (without colon)
      const twitterUserPattern = /(?<![\.\/])@([A-Za-z0-9_]+[A-Za-z0-9_]*)(?![\.:])/g;
      processedAnalysis = processedAnalysis.replace(twitterUserPattern, (match, username) => {
        // Clean the username of any remaining special characters
        username = username.replace(/[^A-Za-z0-9_]/g, '');

        // Create a link to the user's profile
        return `<a href="https://koyn.finance/${username}" 
                   class="twitter-username" 
                   target="_blank" 
                   rel="noopener noreferrer"
                   title="View posts by @${username}">@${username}</a>`;
      });

      // Format entire posts
      processedAnalysis = formatTwitterPosts(processedAnalysis);

      // Convert @mentions to profile links
      processedAnalysis = processedAnalysis.replace(
        /@(\w+)/g,
        `<a href="https://koyn.finance/$1" class="mention" target="_blank" rel="noopener noreferrer">@$1</a>`
      )

      // Convert regular usernames to profile links if they look like Twitter handles
      processedAnalysis = processedAnalysis.replace(
        /(?:^|\s)([A-Za-z0-9_]{1,15})(?=\s|$|[^\w])/g,
        (match, username) => {
          // Only convert if it looks like a valid Twitter handle and isn't already a link
          if (username.length >= 3 && !match.includes('href')) {
            const trimmedMatch = match.trim()
            const leadingSpace = match.startsWith(' ') ? ' ' : ''
            return `${leadingSpace}<a href="https://koyn.finance/${username}" class="username-link" target="_blank" rel="noopener noreferrer">${trimmedMatch}</a>`
          }
          return match
        }
      )

      return processedAnalysis;
    } catch (err) {
      console.error('Error processing analysis content:', err);
      return result.analysis || '';
    }
  };

  // Helper function to format entire Twitter posts
  const formatTwitterPosts = (content: string) => {
    // Split content by line breaks and process each paragraph separately
    const paragraphs = content.split('<br>');

    // Process each paragraph
    const processedParagraphs = paragraphs.map(paragraph => {
      // Look for patterns like:
      // <a class="twitter-username-post">@Username</a>: This is the post content.
      const postRegex = /(<a[^>]+class="twitter-username-post"[^>]+>@[^<]+<\/a>):([^<]+)/;

      const match = paragraph.match(postRegex);

      if (match) {
        const [fullMatch, usernameLink, postContent] = match;
        // Return a styled post container
        return `<div class="twitter-post-container">
          <div class="post-header">${usernameLink}</div>
          <div class="post-content">${postContent.trim()}</div>
        </div>`;
      }

      // If no match, return the paragraph as is
      return paragraph;
    });

    // Join processed paragraphs back with line breaks
    return processedParagraphs.join('<br>');
  };

  // Helper function to format sentiment analysis sections
  const formatSentimentAnalysisSections = (content: string) => {
    // Look for sentiment headings like "Bullish Sentiment:", "Bearish Sentiment:", etc.
    const sentimentRegex = /(- )([\w\s]+) (Sentiment:)/g;

    // Replace the sentiment headings with styled versions
    let processedContent = content.replace(sentimentRegex, (match, dash, sentiment, label) => {
      const sentimentLower = sentiment.toLowerCase();
      let colorClass = 'neutral-sentiment';
      let sectionClass = 'neutral-section';
      
      if (sentimentLower.includes('bull') || sentimentLower.includes('positive')) {
        colorClass = 'bullish-sentiment';
        sectionClass = 'bullish-section';
      } else if (sentimentLower.includes('bear') || sentimentLower.includes('negative')) {
        colorClass = 'bearish-sentiment';
        sectionClass = 'bearish-section';
      } else if (sentimentLower.includes('neutral')) {
        colorClass = 'neutral-sentiment';
        sectionClass = 'neutral-section';
      }

      return `<div class="sentiment-section ${sectionClass}">
        <h4 class="sentiment-heading ${colorClass}">${dash}${sentiment} ${label}</h4>`;
    });

    // Close the sentiment div tags
    // Look for the next sentiment heading or end of content
    const sections = processedContent.split('<div class="sentiment-section');

    // First part is before any sentiment section
    let newContent = sections[0];

    // Process each sentiment section
    for (let i = 1; i < sections.length; i++) {
      const section = sections[i];

      // If this is the last section or there are no more sections
      if (i === sections.length - 1) {
        newContent += '<div class="sentiment-section' + section + '</div>';
      }
      // If there are more sections, close the current one before the next one starts
      else {
        // Find the next heading index
        const nextHeadingIndex = section.indexOf('<div class="sentiment-section');

        if (nextHeadingIndex !== -1) {
          newContent += '<div class="sentiment-section' + section.substring(0, nextHeadingIndex) + '</div>';
          newContent += section.substring(nextHeadingIndex);
        } else {
          newContent += '<div class="sentiment-section' + section + '</div>';
        }
      }
    }

    return newContent;
  };

  // Set up tooltips for article tags after render
  useEffect(() => {
    if (analysisRef.current) {
      try {
        const setupArticleTagTooltips = () => {
          const tagElements = analysisRef.current?.querySelectorAll('.article-tag');
          
          tagElements?.forEach(element => {
            element.addEventListener('mouseenter', () => {
              const tooltip = element.querySelector('.tooltip-content');
              if (tooltip) {
                const rect = tooltip.getBoundingClientRect();
                const parentRect = element.getBoundingClientRect();

                // Check viewport dimensions
                const viewportWidth = window.innerWidth;

                // Default to showing below the element
                (tooltip as HTMLElement).style.top = '100%';
                (tooltip as HTMLElement).style.left = '0';
                (tooltip as HTMLElement).style.right = 'auto';

                // If tooltip would go off right edge of the screen
                if (rect.right > viewportWidth) {
                  (tooltip as HTMLElement).style.left = 'auto';
                  (tooltip as HTMLElement).style.right = '0';
                }

                // If tooltip would go off left edge of the screen
                if (rect.left < 0) {
                  (tooltip as HTMLElement).style.left = '0';
                  (tooltip as HTMLElement).style.right = 'auto';
                }

                // On very small screens, center the tooltip
                if (viewportWidth < 480) {
                  // Make tooltip wider on small screens but not wider than viewport
                  (tooltip as HTMLElement).style.width = Math.min(320, viewportWidth - 40) + 'px';

                  // Center relative to viewport rather than element
                  const tooltipWidth = (tooltip as HTMLElement).offsetWidth;
                  const parentCenter = parentRect.left + (parentRect.width / 2);
                  const leftPosition = Math.max(10, Math.min(viewportWidth - tooltipWidth - 10, parentCenter - (tooltipWidth / 2)));
                  
                  (tooltip as HTMLElement).style.left = `${leftPosition}px`;
                  (tooltip as HTMLElement).style.right = 'auto';
                  (tooltip as HTMLElement).style.position = 'fixed';
                }
              }
            });
          });
        };

        // Run after a short delay to ensure DOM is updated
        setTimeout(setupArticleTagTooltips, 100);
      } catch (err) {
        console.error('Error setting up tooltips:', err);
      }
    }
  }, [result.analysis]);
  
  // const handleSave = async () => {
  //   if (!isSubscribed) {
  //     console.log('Analysis results save button triggering subscription modal');
  //     setTimeout(() => {
  //       onSubscribeClick();
  //     }, 100);
  //     return;
  //   }
    
  //   try {
  //     const response = await fetch('/api/save-result', {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //       },
  //       body: JSON.stringify({
  //         email: userEmail,
  //         resultId: result.actions.result_id,
  //         result: result,
  //       }),
  //     });
      
  //     const data = await response.json();
  //     if (data.success) {
  //       // Update UI to show saved state
  //       result.actions.saved = true;
  //       // Force component update
  //       // setResult({...result});
  //     }
  //   } catch (error) {
  //     console.error('Error saving analysis:', error);
  //   }
  // };

  const handleShare = async () => {
    try {
      // Get subscription ID from localStorage
      let subscriptionId = null
      try {
        const subscriptionData = localStorage.getItem('koyn_subscription')
        if (subscriptionData) {
          const parsed = JSON.parse(subscriptionData)
          subscriptionId = parsed.id || null
        }
      } catch (error) {
        console.warn('Error reading subscription data from localStorage:', error)
      }

      const response = await fetch("https://koyn.finance:3001/api/share-result", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resultId: result.actions.result_id,
          result: result,
          id: subscriptionId,
        }),
      })

      const data = await response.json()
      
      if (data.success) {
        // Copy share URL to clipboard
        navigator.clipboard
          .writeText(data.shareUrl)
          .then(() => {
            alert("Share link copied to clipboard!")
          })
          .catch((err) => {
            console.error("Could not copy link: ", err)
            alert(`Share link: ${data.shareUrl}`)
          })
      } else {
        // Handle different error scenarios
        console.error("Share failed:", data)
        
        if (data.subscription_required) {
          alert(`Sharing requires a subscription: ${data.message || 'Please subscribe to share analysis'}`)
        } else if (response.status === 401) {
          alert("Authentication required. Please sign in to share analysis.")
        } else if (response.status === 400) {
          alert("Invalid request. Please try again.")
        } else {
          alert(`Failed to share analysis: ${data.message || 'Unknown error'}`)
        }
      }
    } catch (error) {
      console.error("Error sharing analysis:", error)
      alert("Failed to share analysis. Please check your connection and try again.")
    }
  }
  
  // Function to render the save button
  // const renderSaveButton = () => {
  //   if (!result.ui_options?.show_save_button) return null;
    
  //   return (
  //     <button 
  //       onClick={handleSave}
  //       className={`action-button save-button flex items-center ${result.actions.saved ? 'saved' : ''}`}
  //       title={result.actions.saved ? 'Saved' : 'Save Analysis'}
  //     >
  //       <span className="icon">
  //         {result.actions.saved ? (
  //           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
  //             <path d="M5 2h14a1 1 0 0 1 1 1v19.143a.5.5 0 0 1-.766.424L12 18.03l-7.234 4.536A.5.5 0 0 1 4 22.143V3a1 1 0 0 1 1-1z" />
  //           </svg>
  //         ) : (
  //           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
  //             <path d="M5 2h14a1 1 0 0 1 1 1v19.143a.5.5 0 0 1-.766.424L12 18.03l-7.234 4.536A.5.5 0 0 1 4 22.143V3a1 1 0 0 1 1-1z" />
  //           </svg>
  //         )}
  //       </span>
  //       <span className="text">{result.actions.saved ? 'Saved' : result.ui_options.save_button_text}</span>
  //     </button>
  //   );
  // };

  // Function to render the share button
  const renderShareButton = () => {
    if (!result.ui_options?.show_share_button) return null;

    return (
      <button 
        onClick={handleShare}
        className="action-button share-button flex items-center"
        title="Share Analysis"
      >
        <span className="icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        </span>
        <span className="text">{result.ui_options.share_button_text}</span>
      </button>
    );
  };

  return (
    <div className="analysis-results rounded-lg p-4 my-4">
      {/* Add Twitter username styling */}
      <style>
        {`
        .twitter-username {
          color: #1DA1F2;
          font-weight: 500;
          text-decoration: none;
          position: relative;
          transition: all 0.2s ease;
          padding: 0 2px;
          border-radius: 3px;
          background-color: rgba(29, 161, 242, 0.1);
        }
        
        .twitter-username:hover {
          color: #0C7ABF;
          text-decoration: underline;
          background-color: rgba(29, 161, 242, 0.2);
        }
        
        .twitter-username::before {
          content: '';
          position: absolute;
          width: 100%;
          transform: scaleX(0);
          height: 2px;
          bottom: 0;
          left: 0;
          background-color: #0C7ABF;
          transform-origin: bottom right;
          transition: transform 0.2s ease-out;
        }
        
        .twitter-username:hover::before {
          transform: scaleX(1);
          transform-origin: bottom left;
        }

        /* Make the underline visible on focus for accessibility */
        .twitter-username:focus {
          outline: none;
          background-color: rgba(29, 161, 242, 0.3);
        }
        
        .twitter-username:focus::before {
          transform: scaleX(1);
          transform-origin: bottom left;
        }

        /* Twitter username in post styling */
        .twitter-username-post {
          color: #1DA1F2;
          font-weight: 600;
          text-decoration: none;
          position: relative;
          transition: all 0.2s ease;
          padding: 0 2px;
        }
        
        .twitter-username-post:hover {
          color: #0C7ABF;
          text-decoration: underline;
        }

        /* Twitter post container styling */
        .twitter-post-container {
          margin: 0.75rem 0;
          padding: 0.75rem;
          border-radius: 0.5rem;
          background-color: rgba(13, 10, 33, 0.4);
          border-left: 3px solid #1DA1F2;
          transition: all 0.2s ease;
        }
        
        .twitter-post-container:hover {
          background-color: rgba(13, 10, 33, 0.6);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }
        
        .post-header {
          margin-bottom: 0.5rem;
          font-weight: 600;
        }
        
        .post-content {
          color: #e2e8f0;
          line-height: 1.5;
        }

        /* Sentiment analysis section styling */
        .sentiment-section {
          margin: 0.75rem 0;
          padding: 0.5rem;
          border-radius: 0.5rem;
          border-left: 3px solid #333;
          background-color: rgba(13, 10, 33, 0.3);
          transition: all 0.2s ease;
        }
        
        .sentiment-section:hover {
          background-color: rgba(13, 10, 33, 0.5);
        }
        
        /* Section color styling */
        .bullish-section {
          border-left-color: #46A758;
        }
        
        .bearish-section {
          border-left-color: #E5484D;
        }
        
        .neutral-section {
          border-left-color: #8E8EA0;
        }
        
        .sentiment-heading {
          font-weight: 600;
          margin-bottom: 0.5rem;
          font-size: 1rem;
        }
        
        .bullish-sentiment {
          color: #46A758;
        }
        
        .bearish-sentiment {
          color: #E5484D;
        }
        
        .neutral-sentiment {
          color: #8E8EA0;
        }

        /* Tooltip styles for article tags */
        .article-tag {
          position: relative;
          display: inline-block;
          color: #95D5B2;
          font-weight: 500;
          background-color: rgba(70, 167, 88, 0.1);
          padding: 0 3px;
          border-radius: 3px;
          cursor: pointer;
        }
        
        .article-tag:hover {
          background-color: rgba(70, 167, 88, 0.2);
        }
        
        .tooltip-content {
          visibility: hidden;
          position: absolute;
          z-index: 1000;
          padding: 12px;
          border-radius: 8px;
          background-color: rgba(13, 10, 33, 0.95);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
          border: 1px solid rgba(149, 213, 178, 0.3);
          width: 300px;
          max-width: calc(100vw - 40px);
          opacity: 0;
          transition: opacity 0.3s, transform 0.3s;
          transform: translateY(10px);
          top: 100%;
          left: 0;
        }
        
        .article-tag:hover .tooltip-content {
          visibility: visible;
          opacity: 1;
          transform: translateY(0);
        }
        
        /* Mobile-specific tooltip styles */
        @media (max-width: 768px) {
          .tooltip-content {
            width: calc(100vw - 40px);
            max-width: 100%;
          }
        }
        
        @media (max-width: 480px) {
          .article-tag {
            border-bottom: 1px dashed #95D5B2;
          }
          
          .tooltip-content {
            position: fixed;
            left: 20px !important; 
            right: 20px !important;
            width: calc(100vw - 40px) !important;
            max-width: calc(100vw - 40px) !important;
          }
        }
        
        /* Fix for small screens to ensure tooltip content doesn't overflow */
        .tooltip-content h4 {
          word-break: break-word;
          overflow-wrap: break-word;
        }
        
        .tooltip-content p {
          word-break: break-word;
          overflow-wrap: break-word;
        }
        `}
      </style>

      <div className="asset-header flex justify-between items-center mb-4">
        <div className="asset-info">
          <h2 className="text-xl font-bold text-white">{result.asset.name} {result.asset.symbol && `(${result.asset.symbol})`}</h2>
          <div className="asset-meta flex space-x-4 text-sm">
            <span className="sentiment">
              <span className={`sentiment-${result.social_sentiment?.toLowerCase()}`}>
                {result.social_sentiment}
              </span>
            </span>
            <span className="price text-[#46A758]">${result.asset_price}</span>
            <span className={`change ${result.price_change_percentage >= 0 ? 'text-[#46A758]' : 'text-[#e11d48]'}`}>
              {result.price_change_percentage >= 0 ? '+' : ''}{result.price_change_percentage.toFixed(2)}% YTD
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="action-buttons flex space-x-2">
          {/* {renderSaveButton()} */}
          {renderShareButton()}
        </div>
      </div>

      {/* Chart Section - Display Chart Here */}
      <div className="chart-container mb-4" style={{ height: '400px' }}>
        {result.asset?.symbol ? (
          <div className="h-full w-full">
            <LightweightChart 
              symbol={result.asset.symbol}
              assetType={result.asset.type}
                chartData={result.chart}
            />
          </div>
        ) : (
          <div className="chart-placeholder bg-[rgba(64,47,181,0.2)] h-full rounded flex items-center justify-center text-[#a099d8]">
            Chart Loading...
          </div>
        )}
      </div>

      {/* Analysis Section */}
      <div className="analysis-section mt-4">
        <h3 className="text-lg font-semibold text-white mb-2">Analysis</h3>
        <div
          ref={analysisRef}
          className="analysis-content text-[#cbd5e1] prose prose-invert prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: processAnalysisContent() }}
        />
      </div>
    </div>
  );
};

export default AnalysisResults; 