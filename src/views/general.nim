# SPDX-License-Identifier: AGPL-3.0-only
import uri, strutils, strformat
import karax/[karaxdsl, vdom]

# Import StyleAttr from karax/vstyles
import karax/vstyles

import renderutils
import ../utils, ../types, ../prefs, ../formatters

import jester

const
  doctype = "<!DOCTYPE html>\n"
  lp = readFile("public/lp.svg")

proc toTheme(theme: string): string =
  theme.toLowerAscii.replace(" ", "_")

proc renderNavbar(cfg: Config; req: Request; rss, canonical: string): VNode =
  var path = req.params.getOrDefault("referer")
  if path.len == 0:
    path = $(parseUri(req.path) ? filterParams(req.params))
    if "/status/" in path: path.add "#m"

  buildHtml(nav(class="border-b border-[rgba(255,255,255,0.3)]")):
    tdiv(class="inner-nav"):
      # Left side - logo and site name
      tdiv(class="nav-item left-nav-item"):
        a(href="/", class="flex items-center no-hover"): 
          img(class="site-logo", src="/logo.jpg", alt="Koyn.ai Logo")
          span(class="site-name"): text ""
      
      # Right side - search icon
      tdiv(class="nav-item right-nav-item"):
        a(href="/search", class="search-link", title="Search"):
          tdiv(class="icon-search-ai"):
            verbatim """
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            """

# Add particles canvas script
proc renderParticlesScript(): VNode =
  buildHtml(script):
    verbatim """
    document.addEventListener('DOMContentLoaded', function() {
      const canvas = document.getElementById('particles-canvas');
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight;
          
          const particles = [];
          
          class Particle {
            constructor() {
              this.x = Math.random() * canvas.width;
              this.y = Math.random() * canvas.height;
              this.size = Math.random() * 2 + 0.5;
              this.speedX = Math.random() * 0.2 - 0.1;
              this.speedY = Math.random() * 0.2 - 0.1;
              
              // Star-like color palette
              const colors = [
                'rgba(255, 255, 255, 0.8)',  // Bright white star
                'rgba(255, 255, 255, 0.6)',  // Medium white star
                'rgba(255, 255, 255, 0.4)',  // Dim white star
                'rgba(248, 249, 250, 0.7)',  // Off-white star
                'rgba(255, 255, 240, 0.6)',  // Ivory star
                'rgba(255, 253, 208, 0.5)'   // Subtle warm yellow star
              ];
              this.color = colors[Math.floor(Math.random() * colors.length)];
            }
            
            update() {
              this.x += this.speedX;
              this.y += this.speedY;
              
              if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
              if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
            }
            
            draw() {
              ctx.beginPath();
              ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
              ctx.fillStyle = this.color;
              ctx.globalAlpha = 0.2;
              ctx.fill();
            }
          }
          
          function createParticles() {
            for (let i = 0; i < 50; i++) {
              particles.push(new Particle());
            }
          }
          
          function animateParticles() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            for (let i = 0; i < particles.length; i++) {
              particles[i].update();
              particles[i].draw();
            }
            
            requestAnimationFrame(animateParticles);
          }
          
          createParticles();
          animateParticles();
          
          // Handle window resize
          window.addEventListener('resize', () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
          });
        }
      }
    });
    """

# Add Google Analytics script
proc renderGoogleAnalytics(): VNode =
  buildHtml(tdiv):
    script(async="", src="https://www.googletagmanager.com/gtag/js?id=G-LSMDJNYGH9")
    script:
      verbatim """
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-LSMDJNYGH9');
      """

proc renderHead*(prefs: Prefs; cfg: Config; req: Request; titleText=""; desc="";
                 video=""; images: seq[string] = @[]; banner=""; ogTitle="";
                 rss=""; canonical=""): VNode =
  var theme = prefs.theme.toTheme
  if "theme" in req.params:
    theme = req.params["theme"].toTheme
    
  let ogType =
    if video.len > 0: "video"
    elif rss.len > 0: "object"
    elif images.len > 0: "photo"
    else: "article"

  let opensearchUrl = getUrlPrefix(cfg) & "/opensearch"

  buildHtml(head):
    link(rel="stylesheet", type="text/css", href="/css/style.css?v=19")
    link(rel="stylesheet", type="text/css", href="/css/fontello.css?v=2")
    link(rel="stylesheet", type="text/css", href="/css/koynlabs.css?v=1")
    if theme.len > 0:
      link(rel="stylesheet", type="text/css", href=(&"/css/themes/{theme}.css"))

    link(rel="apple-touch-icon", sizes="180x180", href="/apple-touch-icon.png")
    link(rel="icon", type="image/png", sizes="32x32", href="/favicon-32x32.png")
    link(rel="icon", type="image/png", sizes="16x16", href="/favicon-16x16.png")
    link(rel="manifest", href="/site.webmanifest")
    link(rel="mask-icon", href="/safari-pinned-tab.svg", color="#ff6c60")
    link(rel="search", type="application/opensearchdescription+xml", title=cfg.title,
                            href=opensearchUrl)

    if canonical.len > 0:
      link(rel="canonical", href=canonical)

    if cfg.enableRss and rss.len > 0:
      link(rel="alternate", type="application/rss+xml", href=rss, title="RSS feed")

    if prefs.hlsPlayback:
      script(src="/js/hls.min.js", `defer`="")
      script(src="/js/hlsPlayback.js", `defer`="")

    if prefs.infiniteScroll:
      script(src="/js/infiniteScroll.js", `defer`="")

    title:
      if titleText.len > 0:
        text titleText & " | " & cfg.title
      else:
        text cfg.title

    meta(name="viewport", content="width=device-width, initial-scale=1.0")
    meta(name="theme-color", content="#1F1F1F")
    meta(property="og:type", content=ogType)
    meta(property="og:title", content=(if ogTitle.len > 0: ogTitle else: titleText))
    meta(property="og:description", content=stripHtml(desc))
    meta(property="og:site_name", content="koyn.ai")
    meta(property="og:locale", content="en_US")

    if banner.len > 0 and not banner.startsWith('#'):
      let bannerUrl = getPicUrl(banner)
      link(rel="preload", type="image/png", href=bannerUrl, `as`="image")

    for url in images:
      let preloadUrl = if "400x400" in url: getPicUrl(url)
                       else: getSmallPic(url)
      link(rel="preload", type="image/png", href=preloadUrl, `as`="image")

      let image = getUrlPrefix(cfg) & getPicUrl(url)
      meta(property="og:image", content=image)
      meta(property="twitter:image:src", content=image)

      if rss.len > 0:
        meta(property="twitter:card", content="summary")
      else:
        meta(property="twitter:card", content="summary_large_image")

    if video.len > 0:
      meta(property="og:video:url", content=video)
      meta(property="og:video:secure_url", content=video)
      meta(property="og:video:type", content="text/html")

    # Add Google Analytics scripts
    renderGoogleAnalytics()

    # this is last so images are also preloaded
    # if this is done earlier, Chrome only preloads one image for some reason
    link(rel="preload", type="font/woff2", `as`="font",
         href="/fonts/fontello.woff2?21002321", crossorigin="anonymous")

    # Add particles script
    renderParticlesScript()

proc renderMain*(body: VNode; req: Request; cfg: Config; prefs=defaultPrefs;
                 titleText=""; desc=""; ogTitle=""; rss=""; video="";
                 images: seq[string] = @[]; banner=""): string =

  let canonical = getTwitterLink(req.path, req.params)

  let node = buildHtml(html(lang="en")):
    renderHead(prefs, cfg, req, titleText, desc, video, images, banner, ogTitle,
               rss, canonical)

    body:
      # Add particles canvas for background effect
      canvas(id="particles-canvas")
      renderNavbar(cfg, req, rss, canonical)

      tdiv(class="container"):
          body

  result = doctype & $node

proc renderError*(error: string): VNode =
  buildHtml(tdiv(class="panel-container")):
    tdiv(class="error-panel"):
      span: verbatim error