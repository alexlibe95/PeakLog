import React from 'react';
import Navigation from '@/components/Navigation';

const Testing = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold">Testing</h1>
        <p className="text-muted-foreground">Testing page is under development</p>
      </div>
    </div>
  );
};

export default Testing;
