export default function Footer() {
  return (
    <footer className="relative z-10 py-6 mt-auto bg-[#000000]">
      <div className="max-w-[1200px] mx-auto px-6 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center">
    <div className="mb-4 md:mb-0">
      <p className="text-[#a099d8] text-sm">
        &copy; {new Date().getFullYear()} koyn.ai - All rights reserved
      </p>
    </div>
    <div className="flex flex-wrap space-x-4 md:space-x-6">
      <a href="mailto:hi@koyn.ai" className="text-[#a099d8] hover:text-white text-sm transition-colors">
        Contact Support
      </a>
      <a href="#" className="text-[#a099d8] hover:text-white text-sm transition-colors">
        Terms of Service
      </a>
      <a href="#" className="text-[#a099d8] hover:text-white text-sm transition-colors">
        Privacy Policy
      </a>
    </div>
  </div>
</div>
</footer>
  );
}
