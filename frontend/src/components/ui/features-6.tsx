import React from 'react'
import { Cpu, Lock, Sparkles, Zap } from 'lucide-react'

export function Features() {
    return (
        <section className="py-16 md:py-32" style={{ padding: '40px 24px' }}>
            <div className="mx-auto max-w-5xl space-y-12 px-6" style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '40px' }}>
                {/* Header Section */}
                <div className="relative z-10 grid items-center gap-4 md:grid-cols-2 md:gap-12" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', alignItems: 'center' }}>
                    <h2 className="text-4xl font-semibold text-glow-cyan" style={{ fontSize: '32px', fontWeight: '800', color: 'white' }}>
                        The Lyra ecosystem brings together our models
                    </h2>
                    <p className="max-w-sm sm:ml-auto" style={{ color: '#94a3b8', fontSize: '15px', lineHeight: '1.6' }}>
                        Empower your team with workflows that adapt to your needs, whether you prefer git synchronization or an AI Agents interface.
                    </p>
                </div>

                {/* Dashboard / Payments illustration panel */}
                <div className="relative rounded-3xl p-3 md:-mx-8 lg:col-span-3 glass-panel" style={{ padding: '12px', borderRadius: '24px', position: 'relative', overflow: 'hidden' }}>
                    <div className="aspect-[88/36] relative" style={{ width: '100%', aspectRatio: '88/36', position: 'relative', overflow: 'hidden', borderRadius: '16px' }}>
                        <div className="bg-gradient-to-t z-1 from-background absolute inset-0 to-transparent" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, var(--bg-primary), transparent)', zIndex: 1 }}></div>
                        
                        {/* Upper Overlay Image (Abstract tech graphic) */}
                        <img 
                            src="https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=1600&q=80" 
                            className="absolute inset-0 z-10" 
                            alt="Payments overlay illustration" 
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 10, opacity: 0.85 }} 
                        />
                        
                        {/* Dark Mode Dashboard Mockup */}
                        <img 
                            src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1600&q=80" 
                            className="hidden dark:block" 
                            alt="Dashboard illustration dark" 
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        />
                        
                        {/* Light Mode Dashboard Mockup (Hidden under dark theme but kept for structure) */}
                        <img 
                            src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1600&q=80" 
                            className="dark:hidden" 
                            alt="Dashboard illustration light" 
                            style={{ display: 'none', width: '100%', height: '100%', objectFit: 'cover' }} 
                        />
                    </div>
                </div>

                {/* Features list */}
                <div className="relative mx-auto grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-8 lg:grid-cols-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
                    
                    {/* Fast */}
                    <div className="space-y-3" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div className="flex items-center gap-2" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)' }}>
                            <Zap className="size-4" size={16} />
                            <h3 className="text-sm font-medium" style={{ fontSize: '15px', fontWeight: '700', color: 'white' }}>Fast Execution</h3>
                        </div>
                        <p className="text-muted-foreground text-sm" style={{ color: '#64748b', fontSize: '13px', lineHeight: '1.5' }}>
                            It supports the entire flow, helping developers innovate and optimize trading loops.
                        </p>
                    </div>

                    {/* Powerful */}
                    <div className="space-y-2" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div className="flex items-center gap-2" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-success)' }}>
                            <Cpu className="size-4" size={16} />
                            <h3 className="text-sm font-medium" style={{ fontSize: '15px', fontWeight: '700', color: 'white' }}>Powerful AI</h3>
                        </div>
                        <p className="text-muted-foreground text-sm" style={{ color: '#64748b', fontSize: '13px', lineHeight: '1.5' }}>
                            Features standard deep neural nets and gradient boosting models to forecast markets.
                        </p>
                    </div>

                    {/* Security */}
                    <div className="space-y-2" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div className="flex items-center gap-2" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-danger)' }}>
                            <Lock className="size-4" size={16} />
                            <h3 className="text-sm font-medium" style={{ fontSize: '15px', fontWeight: '700', color: 'white' }}>Top-tier Security</h3>
                        </div>
                        <p className="text-muted-foreground text-sm" style={{ color: '#64748b', fontSize: '13px', lineHeight: '1.5' }}>
                            Locks configuration and risk parameters into sandboxed local databases.
                        </p>
                    </div>

                    {/* AI Powered */}
                    <div className="space-y-2" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div className="flex items-center gap-2" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-warning)' }}>
                            <Sparkles className="size-4" size={16} />
                            <h3 className="text-sm font-medium" style={{ fontSize: '15px', fontWeight: '700', color: 'white' }}>AI Ecosystem</h3>
                        </div>
                        <p className="text-muted-foreground text-sm" style={{ color: '#64748b', fontSize: '13px', lineHeight: '1.5' }}>
                            Unified agentic interfaces connecting strategies to live market flows.
                        </p>
                    </div>

                </div>
            </div>
        </section>
    )
}
