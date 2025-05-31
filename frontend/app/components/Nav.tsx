import { Routes } from "../utils/routes";
import { useSubscription } from "../context/AuthProvider";
import SubscribeButton from "./SubscribeButton";

export default function Nav() {
  return (
    <nav className="border-b border-[#f0f0f0]">
      <div className="inner-nav max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <div className="nav-item flex items-center">
          <a href={Routes.HOME} className="flex items-center">
            <img
              className="site-logo h-8 rounded-md object-cover h-8 w-auto mr-2"
              src="/logo.jpg"
              alt="Koyn.Finance"
            />
            <span className="site-name text-lg font-semibold text-white">
              <span className="text-xs">finance</span>
            </span>
          </a>
        </div>

        {/* Nav items on the right side with subscribe button first, then social buttons */}
        <div className="nav-right flex items-center gap-2">
          {/* Subscribe button */}
          <div className="nav-item">
            <SubscribeButton />
          </div>

          {/* Social Media buttons with the same styling as SubscribeButton */}
          <div className="nav-item flex items-center gap-2">
            {/* Discord Button */}
            <div className="glowing-input-container button-container">
              <div className="glow"></div>
              <div className="darkBorderBg"></div>
              <div className="darkBorderBg"></div>
              <div className="darkBorderBg"></div>
              <div className="white"></div>
              <div className="border"></div>
              
              <div className="input-main" style={{ width: '40px', height: '40px' }}>
                <a 
                  href="https://discord.gg/VCsSxA3y"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Join us on Discord"
                  className="subscribe-button"
                  style={{
                    top: '0',
                    right: '0',
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onTouchStart={(e) => {
                    const parent = e.currentTarget.closest('.glowing-input-container');
                    if (parent) {
                      parent.querySelector('.glow')?.classList.add('active');
                    }
                  }}
                  onTouchEnd={(e) => {
                    const parent = e.currentTarget.closest('.glowing-input-container');
                    if (parent) {
                      parent.querySelector('.glow')?.classList.remove('active');
                    }
                  }}
                >
                  {/* Discord Icon */}
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 127.14 96.36" fill="currentColor">
                    <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
                  </svg>
                </a>
                <div className="button-border" style={{ right: '0', top: '0', height: '40px', width: '40px' }}></div>
              </div>
            </div>

            {/* Telegram Button */}
            <div className="glowing-input-container button-container">
              <div className="glow"></div>
              <div className="darkBorderBg"></div>
              <div className="darkBorderBg"></div>
              <div className="darkBorderBg"></div>
              <div className="white"></div>
              <div className="border"></div>
              
              <div className="input-main" style={{ width: '40px', height: '40px' }}>
                <a 
                  href="https://t.me/koynlabs"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Join us on Telegram"
                  className="subscribe-button"
                  style={{
                    top: '0',
                    right: '0',
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onTouchStart={(e) => {
                    const parent = e.currentTarget.closest('.glowing-input-container');
                    if (parent) {
                      parent.querySelector('.glow')?.classList.add('active');
                    }
                  }}
                  onTouchEnd={(e) => {
                    const parent = e.currentTarget.closest('.glowing-input-container');
                    if (parent) {
                      parent.querySelector('.glow')?.classList.remove('active');
                    }
                  }}
                >
                  {/* Telegram Icon */}
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.96 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                  </svg>
                </a>
                <div className="button-border" style={{ right: '0', top: '0', height: '40px', width: '40px' }}></div>
              </div>
            </div>

            {/* Twitter/X Button */}
            <div className="glowing-input-container button-container">
              <div className="glow"></div>
              <div className="darkBorderBg"></div>
              <div className="darkBorderBg"></div>
              <div className="darkBorderBg"></div>
              <div className="white"></div>
              <div className="border"></div>
              
              <div className="input-main" style={{ width: '40px', height: '40px' }}>
                <a 
                  href="https://x.com/koyn_ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Follow us on X"
                  className="subscribe-button"
                  style={{
                    top: '0',
                    right: '0',
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onTouchStart={(e) => {
                    const parent = e.currentTarget.closest('.glowing-input-container');
                    if (parent) {
                      parent.querySelector('.glow')?.classList.add('active');
                    }
                  }}
                  onTouchEnd={(e) => {
                    const parent = e.currentTarget.closest('.glowing-input-container');
                    if (parent) {
                      parent.querySelector('.glow')?.classList.remove('active');
                    }
                  }}
                >
                  {/* X/Twitter Icon */}
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13.6823 10.6218L20.2391 3H18.6854L12.9921 9.61788L8.44486 3H3.2002L10.0765 13.0074L3.2002 21H4.75404L10.7663 14.0113L15.5685 21H20.8131L13.6819 10.6218H13.6823ZM11.5541 13.0956L10.8574 12.0991L5.31391 4.16971H7.70053L12.1742 10.5689L12.8709 11.5655L18.6861 19.8835H16.2995L11.5541 13.096V13.0956Z" />
                  </svg>
                </a>
                <div className="button-border" style={{ right: '0', top: '0', height: '40px', width: '40px' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
