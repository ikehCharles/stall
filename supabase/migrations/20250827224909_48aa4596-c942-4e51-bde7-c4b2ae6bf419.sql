-- Market and Stall Management System Database Schema

-- Create market status enum
CREATE TYPE market_status AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- Create stall shape enum  
CREATE TYPE stall_shape AS ENUM ('RECT', 'CIRCLE', 'POLY');

-- Create stall status enum
CREATE TYPE stall_status AS ENUM ('AVAILABLE', 'BOOKED', 'BLOCKED');

-- Create markets table
CREATE TABLE public.markets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  theme TEXT NOT NULL DEFAULT 'default',
  banner_url TEXT,
  start_at TIMESTAMP WITH TIME ZONE NOT NULL,
  end_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status market_status NOT NULL DEFAULT 'DRAFT',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT valid_dates CHECK (start_at < end_at)
);

-- Create stall_templates table
CREATE TABLE public.stall_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  shape stall_shape NOT NULL DEFAULT 'RECT',
  fill_color TEXT NOT NULL DEFAULT '#3b82f6',
  stroke_color TEXT NOT NULL DEFAULT '#1e40af', 
  width NUMERIC NOT NULL DEFAULT 80,
  height NUMERIC NOT NULL DEFAULT 60,
  radius NUMERIC NULL, -- For circles
  price NUMERIC NOT NULL DEFAULT 100,
  capacity INTEGER DEFAULT 1,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create market_layouts table (1:1 with markets)
CREATE TABLE public.market_layouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  market_id UUID NOT NULL UNIQUE,
  canvas_width NUMERIC NOT NULL DEFAULT 800,
  canvas_height NUMERIC NOT NULL DEFAULT 600,
  unit TEXT NOT NULL DEFAULT 'px',
  grid_size NUMERIC NOT NULL DEFAULT 20,
  
  CONSTRAINT fk_market_layouts_market FOREIGN KEY (market_id) 
    REFERENCES public.markets(id) ON DELETE CASCADE
);

-- Create stall_instances table
CREATE TABLE public.stall_instances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  market_id UUID NOT NULL,
  template_id UUID NOT NULL,
  label TEXT NOT NULL,
  x NUMERIC NOT NULL,
  y NUMERIC NOT NULL,
  width NUMERIC NOT NULL,
  height NUMERIC NOT NULL,
  rotation NUMERIC NOT NULL DEFAULT 0,
  price_override NUMERIC NULL, -- NULL means use template price
  status stall_status NOT NULL DEFAULT 'AVAILABLE',
  
  CONSTRAINT fk_stall_instances_market FOREIGN KEY (market_id) 
    REFERENCES public.markets(id) ON DELETE CASCADE,
  CONSTRAINT fk_stall_instances_template FOREIGN KEY (template_id) 
    REFERENCES public.stall_templates(id) ON DELETE RESTRICT
);

-- Add indexes for performance
CREATE INDEX idx_markets_status ON public.markets(status);
CREATE INDEX idx_markets_created_by ON public.markets(created_by);
CREATE INDEX idx_stall_instances_market ON public.stall_instances(market_id);
CREATE INDEX idx_stall_instances_status ON public.stall_instances(status);

-- Enable Row Level Security
ALTER TABLE public.markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stall_templates ENABLE ROW LEVEL SECURITY;  
ALTER TABLE public.market_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stall_instances ENABLE ROW LEVEL SECURITY;

-- RLS Policies for markets (admin only)
CREATE POLICY "Admins can view all markets" 
ON public.markets 
FOR SELECT 
USING (get_user_role(auth.uid()) = 'admin'::app_role);

CREATE POLICY "Admins can create markets" 
ON public.markets 
FOR INSERT 
WITH CHECK (get_user_role(auth.uid()) = 'admin'::app_role);

CREATE POLICY "Admins can update markets" 
ON public.markets 
FOR UPDATE 
USING (get_user_role(auth.uid()) = 'admin'::app_role);

CREATE POLICY "Admins can delete markets" 
ON public.markets 
FOR DELETE 
USING (get_user_role(auth.uid()) = 'admin'::app_role);

-- RLS Policies for stall_templates (admin only)
CREATE POLICY "Admins can view all templates" 
ON public.stall_templates 
FOR SELECT 
USING (get_user_role(auth.uid()) = 'admin'::app_role);

CREATE POLICY "Admins can create templates" 
ON public.stall_templates 
FOR INSERT 
WITH CHECK (get_user_role(auth.uid()) = 'admin'::app_role);

CREATE POLICY "Admins can update templates" 
ON public.stall_templates 
FOR UPDATE 
USING (get_user_role(auth.uid()) = 'admin'::app_role);

CREATE POLICY "Admins can delete templates" 
ON public.stall_templates 
FOR DELETE 
USING (get_user_role(auth.uid()) = 'admin'::app_role);

-- RLS Policies for market_layouts (admin only)
CREATE POLICY "Admins can view all layouts" 
ON public.market_layouts 
FOR SELECT 
USING (get_user_role(auth.uid()) = 'admin'::app_role);

CREATE POLICY "Admins can manage layouts" 
ON public.market_layouts 
FOR INSERT 
WITH CHECK (get_user_role(auth.uid()) = 'admin'::app_role);

CREATE POLICY "Admins can update layouts" 
ON public.market_layouts 
FOR UPDATE 
USING (get_user_role(auth.uid()) = 'admin'::app_role);

-- RLS Policies for stall_instances (admin only)  
CREATE POLICY "Admins can view all stall instances" 
ON public.stall_instances 
FOR SELECT 
USING (get_user_role(auth.uid()) = 'admin'::app_role);

CREATE POLICY "Admins can create stall instances" 
ON public.stall_instances 
FOR INSERT 
WITH CHECK (get_user_role(auth.uid()) = 'admin'::app_role);

CREATE POLICY "Admins can update stall instances" 
ON public.stall_instances 
FOR UPDATE 
USING (get_user_role(auth.uid()) = 'admin'::app_role);

CREATE POLICY "Admins can delete stall instances" 
ON public.stall_instances 
FOR DELETE 
USING (get_user_role(auth.uid()) = 'admin'::app_role);

-- Add updated_at trigger for markets
CREATE TRIGGER update_markets_updated_at
BEFORE UPDATE ON public.markets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();