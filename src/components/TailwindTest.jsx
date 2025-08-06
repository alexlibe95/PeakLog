import { Button } from "@/components/ui/button"

const ShadcnTest = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md mx-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          🏔️ PeakLog
        </h1>
        <p className="text-gray-600 mb-6">
          Training and performance tracking for sports teams
        </p>
        <div className="space-y-4">
          <div className="bg-green-100 text-green-800 px-4 py-2 rounded-md">
            ✅ React + Vite configured
          </div>
          <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-md">
            ✅ ShadCN UI working perfectly
          </div>
          <div className="bg-purple-100 text-purple-800 px-4 py-2 rounded-md">
            🚀 Ready for development
          </div>
          <div className="flex gap-2 pt-4">
            <Button>Primary Button</Button>
            <Button variant="outline">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShadcnTest;