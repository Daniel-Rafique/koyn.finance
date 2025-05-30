import React, { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import AnalysisResults from "../components/AnalysisResults"
import Nav from "~/components/Nav"
import NewsCarousel from "~/components/NewsCarousel"
import "../styles/analysis-results.css"
import "../styles/news-carousel-solid.css";
import "../styles/glowing-input.css";

interface SharedAnalysisData {
  resultId: string
  shareId: string
  result: any
  sharedAt: string
}

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
      <Nav />
  
      
      <div className="container mx-auto px-4 py-8 relative" style={{ zIndex: 2 }}>
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Shared Analysis</h1>
          <p className="text-white text-sm">
            Shared on {new Date(analysisData?.sharedAt || Date.now()).toLocaleDateString()}
          </p>
          <a 
            href="/" 
            className="inline-block mt-4 px-3 py-1 text-sm bg-white text-black rounded hover:bg-gray-200 transition-colors"
          >
            Try Koyn.finance
          </a>
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