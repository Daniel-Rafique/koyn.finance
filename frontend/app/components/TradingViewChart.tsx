import React, { useEffect, useRef, memo } from 'react';
import formatSymbolForTradingView, { loadAssetData } from '../utils/assetFormatter';

interface TradingViewChartProps {
  symbol?: string;
  theme?: 'light' | 'dark';
  assetType?: string;
}

function TradingViewChart({ 
  symbol = "BINANCE:BTCUSDT", 
  theme = "dark",
  assetType
}: TradingViewChartProps) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load asset data when component mounts
    loadAssetData();
  }, []);

  useEffect(() => {
    // Clean up any previous instance
    if (container.current) {
      container.current.innerHTML = '';
    }

    // Debug logging for symbol formatting
    console.log('TradingView Chart Debug:', {
      originalSymbol: symbol,
      assetType: assetType,
      symbolLength: symbol?.length,
      symbolPattern: symbol?.match(/^[A-Z]{3,6}$/) ? 'Stock-like' : 'Other',
      isYMUSD: symbol === 'YMUSD',
      isUS30: symbol === 'US30'
    });

    // Format the symbol for TradingView using our utility
    const formattedSymbol = formatSymbolForTradingView(symbol, assetType);
    
    console.log(`TradingView: Formatted symbol "${symbol}" (type: ${assetType || 'auto-detected'}) -> "${formattedSymbol}"`);

    // Special logging for YMUSD/US30 symbols
    if (symbol === 'YMUSD' || symbol === 'US30' || symbol === 'YM') {
      console.log(`US30/YMUSD Debug: Original="${symbol}", Formatted="${formattedSymbol}", AssetType="${assetType}"`);
    }

    // Validate that we have a properly formatted symbol
    if (!formattedSymbol || formattedSymbol === symbol && !symbol.includes(':')) {
      console.warn(`TradingView: Symbol formatting may have failed. Original: "${symbol}", Formatted: "${formattedSymbol}", Type: "${assetType}"`);
    }

    // Create script element and widget container
    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'tradingview-widget-container__widget';
    widgetContainer.style.height = '100%';
    widgetContainer.style.width = '100%';

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: formattedSymbol,
      interval: "D",
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      allow_symbol_change: true,
      calendar: false,
      support_host: "https://www.tradingview.com",
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: true,
      hide_volume: false,
      studies: ["Volume@tv-basicstudies"],
      overrides: {
        "paneProperties.background": "rgba(0, 0, 0, 0)",
        "paneProperties.backgroundType": "solid",
        "paneProperties.vertGridProperties.color": "rgba(0, 0, 0, 0)",
        "paneProperties.horzGridProperties.color": "rgba(0, 0, 0, 0)",
        "paneProperties.vertGridProperties.style": 0,
        "paneProperties.horzGridProperties.style": 0,
        "symbolWatermarkProperties.transparency": 98,
        "symbolWatermarkProperties.color": "rgba(255, 255, 255, 0.02)",
        "scalesProperties.textColor": "#FFFFFF",
        "scalesProperties.backgroundColor": "rgba(0, 0, 0, 0)",
        "scalesProperties.lineColor": "rgba(255, 255, 255, 0.05)",
        "scalesProperties.fontSize": 11,
        "mainSeriesProperties.candleStyle.upColor": "#46A758",
        "mainSeriesProperties.candleStyle.downColor": "#E5484D",
        "mainSeriesProperties.candleStyle.borderUpColor": "#46A758",
        "mainSeriesProperties.candleStyle.borderDownColor": "#E5484D",
        "mainSeriesProperties.candleStyle.wickUpColor": "#46A758",
        "mainSeriesProperties.candleStyle.wickDownColor": "#E5484D",
        "volumePaneSize": "medium",
        "mainSeriesProperties.priceLineColor": "#FFFFFF",
        "mainSeriesProperties.priceLineWidth": 1,
        "crosshairProperties.color": "rgba(255, 255, 255, 0.3)",
        "crosshairProperties.width": 1,
        "crosshairProperties.style": 2,
        "chartProperties.background": "rgba(0, 0, 0, 0)",
        "chartProperties.backgroundType": "solid"
      },
      disabled_features: [
        "use_localstorage_for_settings",
        "volume_force_overlay",
        "create_volume_indicator_by_default",
        "header_symbol_search",
        "symbol_search_hot_key",
        "header_compare",
        "compare_symbol",
        "header_undo_redo",
        "header_screenshot",
        "header_chart_type",
        "header_settings",
        "header_indicators",
        "header_fullscreen_button",
        "left_toolbar",
        "control_bar",
        "timeframes_toolbar",
        "edit_buttons_in_legend",
        "context_menus",
        "border_around_the_chart",
        "remove_library_container_border"
      ],
      enabled_features: [
        "study_templates",
        "side_toolbar_in_fullscreen_mode"
      ]
    });
    
    if (container.current) {
      container.current.appendChild(widgetContainer);
      container.current.appendChild(script);
      console.log(`TradingView widget created for symbol: ${formattedSymbol}`);
    }
    
    return () => {
      // Clean up on unmount
      if (container.current) {
        container.current.innerHTML = '';
      }
    };
  }, [symbol, theme, assetType]);

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
          /* TradingView CSS Custom Properties for transparent backgrounds */
          :root:not(.theme-dark) {
            --tv-color-platform-background: transparent !important;
            --tv-color-pane-background: transparent !important;
            --tv-color-toolbar-button-background-hover: rgba(255, 255, 255, 0.1) !important;
            --tv-color-toolbar-button-background-expanded: rgba(255, 255, 255, 0.1) !important;
            --tv-color-toolbar-button-background-active: rgba(70, 167, 88, 0.2) !important;
            --tv-color-toolbar-button-background-active-hover: rgba(70, 167, 88, 0.3) !important;
            --tv-color-toolbar-button-text: #FFFFFF !important;
            --tv-color-toolbar-button-text-hover: #FFFFFF !important;
            --tv-color-toolbar-button-text-active: #46A758 !important;
            --tv-color-toolbar-button-text-active-hover: #46A758 !important;
            --tv-color-item-active-text: #46A758 !important;
            --tv-color-toolbar-toggle-button-background-active: rgba(70, 167, 88, 0.2) !important;
            --tv-color-toolbar-toggle-button-background-active-hover: rgba(70, 167, 88, 0.3) !important;
            --tv-color-toolbar-divider-background: rgba(255, 255, 255, 0.1) !important;
            --tv-color-toolbar-save-layout-loader: #FFFFFF !important;
            --tv-color-popup-background: rgba(0, 0, 0, 0.9) !important;
            --tv-color-popup-element-text: #FFFFFF !important;
            --tv-color-popup-element-text-hover: #FFFFFF !important;
            --tv-color-popup-element-background-hover: rgba(255, 255, 255, 0.1) !important;
            --tv-color-popup-element-divider-background: rgba(255, 255, 255, 0.1) !important;
            --tv-color-popup-element-secondary-text: rgba(255, 255, 255, 0.7) !important;
            --tv-color-popup-element-hint-text: rgba(255, 255, 255, 0.5) !important;
            --tv-color-popup-element-text-active: #46A758 !important;
            --tv-color-popup-element-background-active: rgba(70, 167, 88, 0.2) !important;
            --tv-color-popup-element-toolbox-text: #FFFFFF !important;
            --tv-color-popup-element-toolbox-text-hover: #FFFFFF !important;
            --tv-color-popup-element-toolbox-text-active-hover: #46A758 !important;
            --tv-color-popup-element-toolbox-background-hover: rgba(255, 255, 255, 0.1) !important;
            --tv-color-popup-element-toolbox-background-active-hover: rgba(70, 167, 88, 0.2) !important;
          }

          .theme-dark:root {
            --tv-color-platform-background: #000000 !important;
            --tv-color-pane-background: #000000 !important;
            --tv-color-toolbar-button-background-hover: rgba(255, 255, 255, 0.1) !important;
            --tv-color-toolbar-button-background-expanded: rgba(255, 255, 255, 0.1) !important;
            --tv-color-toolbar-button-background-active: rgba(70, 167, 88, 0.2) !important;
            --tv-color-toolbar-button-background-active-hover: rgba(70, 167, 88, 0.3) !important;
            --tv-color-toolbar-button-text: #FFFFFF !important;
            --tv-color-toolbar-button-text-hover: #FFFFFF !important;
            --tv-color-toolbar-button-text-active: #46A758 !important;
            --tv-color-toolbar-button-text-active-hover: #46A758 !important;
            --tv-color-item-active-text: #46A758 !important;
            --tv-color-toolbar-toggle-button-background-active: rgba(70, 167, 88, 0.2) !important;
            --tv-color-toolbar-toggle-button-background-active-hover: rgba(70, 167, 88, 0.3) !important;
            --tv-color-toolbar-divider-background: rgba(255, 255, 255, 0.1) !important;
            --tv-color-toolbar-save-layout-loader: #FFFFFF !important;
            --tv-color-popup-background: rgba(0, 0, 0, 0.9) !important;
            --tv-color-popup-element-text: #FFFFFF !important;
            --tv-color-popup-element-text-hover: #FFFFFF !important;
            --tv-color-popup-element-background-hover: rgba(255, 255, 255, 0.1) !important;
            --tv-color-popup-element-divider-background: rgba(255, 255, 255, 0.1) !important;
            --tv-color-popup-element-secondary-text: rgba(255, 255, 255, 0.7) !important;
            --tv-color-popup-element-hint-text: rgba(255, 255, 255, 0.5) !important;
            --tv-color-popup-element-text-active: #46A758 !important;
            --tv-color-popup-element-background-active: rgba(70, 167, 88, 0.2) !important;
            --tv-color-popup-element-toolbox-text: #FFFFFF !important;
            --tv-color-popup-element-toolbox-text-hover: #FFFFFF !important;
            --tv-color-popup-element-toolbox-text-active-hover: #46A758 !important;
            --tv-color-popup-element-toolbox-background-hover: rgba(255, 255, 255, 0.1) !important;
            --tv-color-popup-element-toolbox-background-active-hover: rgba(70, 167, 88, 0.2) !important;
          }
          
          .tradingview-widget-container {
            background: transparent !important;
            border: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
          }
          .tradingview-widget-container iframe {
            border: none !important;
            border-radius: 0 !important;
            background: transparent !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .tradingview-widget-container__widget {
            background: transparent !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .tradingview-widget-copyright {
            display: none !important;
          }
          .tradingview-widget-container * {
            box-sizing: border-box;
            border: none !important;
            background: transparent !important;
          }
          .tradingview-widget-container .tv-embed-widget-wrapper {
            background: transparent !important;
            border: none !important;
          }
          /* Force all TradingView internal elements to be transparent */
          .tradingview-widget-container iframe[src*="tradingview"] {
            background: transparent !important;
          }
          .tradingview-widget-container div[class*="tv-"] {
            background: transparent !important;
          }
          .tradingview-widget-container div[id*="tradingview"] {
            background: transparent !important;
          }
          /* Override any inline styles */
          .tradingview-widget-container [style*="background"] {
            background: transparent !important;
          }
        `
      }} />
      <div className="tradingview-widget-container" ref={container} style={{ height: "100%", width: "100%" }}>
      </div>
    </>
  );
}

export default memo(TradingViewChart); 