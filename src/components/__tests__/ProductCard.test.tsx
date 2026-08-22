import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProductCard } from '../ProductCard';
import { FoodItem, StoreConfig } from '../../types/store';

vi.mock('../../store/AppContext', () => ({
  useApp: () => ({
    toggleFavorite: vi.fn(),
    isFavorite: vi.fn(() => false),
    config: {
      theme_color: '#E31837',
    },
  }),
}));

const mockConfig: StoreConfig = {
  site_nombre: 'TestStore',
  telefono_soporte: '04121234567',
  direccion_fisica: 'Caracas, Venezuela',
  coordenadas_tienda: { lat: 10.4806, lng: -66.9036 },
  banners: [],
  zelle_enabled: true,
  zelle_data: 'test@email.com',
  zelle_discount_percent: 0,
  pagomovil_enabled: true,
  pagomovil_data: 'Banco 0101',
  pagomovil_discount_percent: 5,
  efectivo_enabled: true,
  efectivo_data: '',
  efectivo_discount_percent: 0,
  transferencia_enabled: false,
  transferencia_data: '',
  transferencia_discount_percent: 0,
  tasa_cambio: 36.5,
  theme_color: '#E31837',
};

const mockItem: FoodItem = {
  id: 'test-001',
  nombre: 'Smash Clásica',
  descripcion: 'Doble smash de carne con queso',
  categoria: ['Hamburguesas'],
  precio_usd: 7.5,
  stock: 30,
  imagen_urls: ['https://example.com/burger.jpg'],
  es_promo: false,
  es_nuevo: false,
  es_mas_vendido: false,
  delivery_gratis: false,
  ingredientes: ['Pan', 'Carne', 'Queso'],
  option_groups: [],
};

const defaultProps = {
  item: mockItem,
  config: mockConfig,
  onViewProductDetails: vi.fn(),
  addToCart: vi.fn(),
};

describe('ProductCard', () => {
  it('renderiza nombre del producto', () => {
    render(<ProductCard {...defaultProps} />);
    expect(screen.getByText('Smash Clásica')).toBeInTheDocument();
  });

  it('renderiza precio del producto', () => {
    render(<ProductCard {...defaultProps} />);
    expect(screen.getByText('$7.50')).toBeInTheDocument();
  });

  it('renderiza imagen del producto', () => {
    render(<ProductCard {...defaultProps} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/burger.jpg');
    expect(img).toHaveAttribute('alt', 'Smash Clásica');
  });

  it('muestra badge PROMO cuando es_promo=true', () => {
    render(<ProductCard {...defaultProps} item={{ ...mockItem, es_promo: true }} />);
    expect(screen.getByText('PROMO')).toBeInTheDocument();
  });

  it('muestra badge NUEVO cuando es_nuevo=true y no es promo', () => {
    render(<ProductCard {...defaultProps} item={{ ...mockItem, es_nuevo: true }} />);
    expect(screen.getByText('NUEVO')).toBeInTheDocument();
  });

  it('muestra badge TOP cuando es_mas_vendido=true y no es promo ni nuevo', () => {
    render(<ProductCard {...defaultProps} item={{ ...mockItem, es_mas_vendido: true }} />);
    expect(screen.getByText('TOP')).toBeInTheDocument();
  });

  it('muestra badge AGOTADO cuando stock=0', () => {
    render(<ProductCard {...defaultProps} item={{ ...mockItem, stock: 0 }} />);
    expect(screen.getByText('AGOTADO')).toBeInTheDocument();
  });

  it('deshabilita botón + cuando agotado', () => {
    render(<ProductCard {...defaultProps} item={{ ...mockItem, stock: 0 }} />);
    const buttons = screen.getAllByRole('button');
    const addButton = buttons.find(b => b.querySelector('.lucide-plus'));
    expect(addButton).toBeDefined();
    expect(addButton).toBeDisabled();
  });

  it('click en card llama a onViewProductDetails', () => {
    render(<ProductCard {...defaultProps} />);
    const card = screen.getByText('Smash Clásica').closest('div')!;
    fireEvent.click(card);
    expect(defaultProps.onViewProductDetails).toHaveBeenCalledWith(mockItem);
  });

  it('click en botón + llama a addToCart', () => {
    render(<ProductCard {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    const addButton = buttons.find(b => b.querySelector('.lucide-plus'));
    expect(addButton).toBeDefined();
    fireEvent.click(addButton!);
    expect(defaultProps.addToCart).toHaveBeenCalledWith(mockItem);
  });

  it('aplica color de tema al precio', () => {
    render(<ProductCard {...defaultProps} config={{ ...mockConfig, theme_color: '#FF0000' }} />);
    const price = screen.getByText('$7.50');
    expect(price).toHaveStyle({ color: '#FF0000' });
  });

  it('maneja imagen con referrerPolicy no-referrer', () => {
    render(<ProductCard {...defaultProps} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('referrerpolicy', 'no-referrer');
  });
});
