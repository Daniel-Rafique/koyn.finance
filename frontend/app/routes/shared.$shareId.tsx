import React, { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import AnalysisResults from "../components/AnalysisResults"
import NewsCarousel from "~/components/NewsCarousel"
import "../styles/analysis-results.css"
import "../styles/news-carousel-solid.css";

interface SharedAnalysisData {
  resultId: string
  shareId: string
  result: any
  sharedAt: string
}

// Meta function for React Router to set page title and description
export const meta = ({ params }: { params: { shareId: string } }) => {
  const shareId = params.shareId;
  
  return [
    { title: `Shared Market Analysis ${shareId ? `- ${shareId}` : ''} | koyn.finance` },
    {
      name: "description",
      content: "View and explore this shared AI-powered financial market analysis with real-time insights, price predictions, and comprehensive market intelligence. Professional-grade analysis shared by the koyn.finance community.",
    },
    { name: "keywords", content: "shared analysis, market insights, financial intelligence, AI trading, sentiment analysis, price prediction, community analysis" },
    { property: "og:title", content: `Shared Market Analysis | koyn.finance` },
    { property: "og:description", content: "AI-powered financial market analysis shared by the koyn.finance community" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: `Shared Market Analysis | koyn.finance` },
    { name: "twitter:description", content: "Professional AI-powered financial analysis shared by the community" },
    { name: "robots", content: "index, follow" }, // Allow indexing for shared content
  ];
};

export default function SharedAnalysis() {
  const { shareId } = useParams()
  const [analysisData, setAnalysisData] = useState<SharedAnalysisData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchSharedAnalysis = async () => {
      if (!shareId) {
        setError("No share ID provided")
        setLoading(false)
        return
      }

      try {
        console.log(`Fetching shared result for shareId: ${shareId}`);
        const response = await fetch(`https://koyn.finance:3001/api/shared-result/${shareId}`)
        console.log(`Response status: ${response.status}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`API error: ${response.status} - ${errorText}`);
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const data = await response.json()
        console.log('API response:', data);
        console.log('API response result:', data.result);
        console.log('API response result keys:', Object.keys(data.result || {}));

        if (data.success) {
          setAnalysisData(data)
        } else {
          setError(data.message || "Failed to load shared analysis")
        }
      } catch (err) {
        console.error("Error fetching shared analysis:", err)
        const errorMessage = err instanceof Error ? err.message : "Unknown error occurred"
        setError(`Failed to load shared analysis: ${errorMessage}`)
      } finally {
        setLoading(false)
      }
    }

    fetchSharedAnalysis()
  }, [shareId])

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
          <p className="text-white">Loading shared analysis...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-400 text-xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-white mb-2">Analysis Not Found</h1>
          <p className="text-white mb-4">{error}</p>
          <a 
            href="/" 
            className="inline-block px-4 py-2 bg-white text-black rounded hover:bg-gray-200 transition-colors"
          >
            Go to Home
          </a>
        </div>
      </div>
    )
  }

  if (!analysisData) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-white">No analysis data found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black relative">
      {/* Particle Background */}
      <canvas
        id="particles-canvas"
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 1 }}
      />
      
      {/* Navigation */}
      {/* <Nav /> */}
  
      
      <div className="container mx-auto px-4 py-8 relative" style={{ zIndex: 2 }}>
        {/* Enhanced Header */}
        <div className="text-center mb-8 max-w-4xl mx-auto">
          {/* Logo */}
          <div className="mb-6">
            <a 
              href="/" 
              className="inline-flex items-center hover:opacity-80 transition-opacity"
            >
              <img src="/logo.jpg" alt="Koyn Logo" className="w-16 h-16 rounded-lg shadow-lg" />
            </a>
          </div>
          
          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Shared <span className="text-[#a099d8]">Market Analysis</span>
          </h1>
          
          {/* Description */}
          <p className="text-gray-300 text-lg md:text-xl leading-relaxed mb-4">
            Professional AI-powered financial intelligence and market insights shared by the koyn.finance community. 
            Explore comprehensive analysis with real-time sentiment tracking and price predictions.
          </p>
          
          {/* Share Info */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-[#a099d8]">
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
              </svg>
              Share ID: {shareId}
            </div>
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Shared on {new Date(analysisData?.sharedAt || Date.now()).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </div>
          </div>
          
          {/* Call to Action */}
          <div className="mt-6">
            <a 
              href="/?subscribe=true" 
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-[#402fb5] to-[#cf30aa] text-white font-medium rounded-lg hover:from-[#3525a3] hover:to-[#b8298a] transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Get Your Own Analysis
            </a>
          </div>
        </div>

        {/* Analysis Results */}
        <div className="max-w-4xl mx-auto">
          <AnalysisResults 
            result={analysisData.result} 
            onSubscribeClick={() => {
              // Redirect to home page with subscription focus
              window.location.href = "/?subscribe=true"
            }}
          />
        </div>

        {/* Footer */}
      </div>
      
      {/* Particle Animation Script */}
      <script dangerouslySetInnerHTML={{
        __html: `
          // Simple particle animation
          const canvas = document.getElementById('particles-canvas');
          if (canvas) {
            const ctx = canvas.getContext('2d');
            let particles = [];
            
            function resizeCanvas() {
              canvas.width = window.innerWidth;
              canvas.height = window.innerHeight;
            }
            
            function createParticle() {
              return {
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                size: Math.random() * 2 + 1,
                opacity: Math.random() * 0.5 + 0.2
              };
            }
            
            function initParticles() {
              particles = [];
              for (let i = 0; i < 50; i++) {
                particles.push(createParticle());
              }
            }
            
            function animate() {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              
              particles.forEach(particle => {
                particle.x += particle.vx;
                particle.y += particle.vy;
                
                if (particle.x < 0 || particle.x > canvas.width) particle.vx *= -1;
                if (particle.y < 0 || particle.y > canvas.height) particle.vy *= -1;
                
                ctx.beginPath();
                ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
                ctx.fillStyle = \`rgba(255, 255, 255, \${particle.opacity})\`;
                ctx.fill();
              });
              
              requestAnimationFrame(animate);
            }
            
            resizeCanvas();
            initParticles();
            animate();
            
            window.addEventListener('resize', () => {
              resizeCanvas();
              initParticles();
            });
          }
        `
      }} />
      {/* News Carousel */}
      <div className="fixed bottom-0 left-0 w-full z-10 bg-black">
        <NewsCarousel 
          accounts={["business", "bitcoin", "crypto", "economics", "markets", "solana", "koynlabs", "koyn_ai"]} 
        />
      </div>
     </div>
    
  )
} 