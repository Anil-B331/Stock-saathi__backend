const itemModel = require('../models/itemModel');

const getItems = async (req, res) => {
  try {
    const items = await itemModel.getAllItems();
    res.status(200).json(items);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getItem = async (req, res) => {
  try {
    const item = await itemModel.getItemById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.status(200).json(item);
  } catch (error) {
    console.error('Error fetching item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const createItem = async (req, res) => {
  try {
    const { name, brand, sku, quantity, category, cost_price, sale_price, photo_url, low_stock_threshold } = req.body;
    
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Item name is required and cannot be blank.' });
    }

    const parsedQty = quantity !== undefined ? parseInt(quantity, 10) : 0;
    if (isNaN(parsedQty) || parsedQty < 0) {
      return res.status(400).json({ error: 'Quantity cannot be negative.' });
    }

    const parsedCost = cost_price !== undefined ? parseFloat(cost_price) : 0;
    if (isNaN(parsedCost) || parsedCost < 0) {
      return res.status(400).json({ error: 'Cost price cannot be negative.' });
    }

    const parsedSale = sale_price !== undefined ? parseFloat(sale_price) : 0;
    if (isNaN(parsedSale) || parsedSale < 0) {
      return res.status(400).json({ error: 'Sale price cannot be negative.' });
    }

    const parsedThreshold = low_stock_threshold !== undefined ? parseInt(low_stock_threshold, 10) : 5;
    if (isNaN(parsedThreshold) || parsedThreshold < 0) {
      return res.status(400).json({ error: 'Low stock threshold cannot be negative.' });
    }

    const newItem = await itemModel.createItem({ 
      name: name.trim(), 
      brand: brand && typeof brand === 'string' ? brand.trim() : null,
      sku: sku && typeof sku === 'string' ? sku.trim() : null, 
      quantity: parsedQty, 
      category: category && typeof category === 'string' ? category.trim() : null, 
      cost_price: parsedCost, 
      sale_price: parsedSale, 
      photo_url, 
      low_stock_threshold: parsedThreshold 
    });
    
    res.status(201).json(newItem);
  } catch (error) {
    console.error('Error creating item:', error);
    if (error.code === '23505') { // Postgres unique violation
      return res.status(409).json({ error: 'An item with this SKU already exists.' });
    }
    res.status(500).json({ error: 'Internal server error while creating item.' });
  }
};

const updateItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, brand, sku, quantity, category, cost_price, sale_price, photo_url, low_stock_threshold } = req.body;
    
    // Role checks
    if (req.user.role === 'staff') {
      if (cost_price !== undefined || sale_price !== undefined) {
        return res.status(403).json({ error: 'Staff members are not allowed to edit prices.' });
      }
    }

    if (name !== undefined && (!name || !name.trim())) {
      return res.status(400).json({ error: 'Item name cannot be blank.' });
    }

    if (quantity !== undefined && (isNaN(parseInt(quantity, 10)) || parseInt(quantity, 10) < 0)) {
      return res.status(400).json({ error: 'Quantity cannot be negative.' });
    }

    if (cost_price !== undefined && (isNaN(parseFloat(cost_price)) || parseFloat(cost_price) < 0)) {
      return res.status(400).json({ error: 'Cost price cannot be negative.' });
    }

    if (sale_price !== undefined && (isNaN(parseFloat(sale_price)) || parseFloat(sale_price) < 0)) {
      return res.status(400).json({ error: 'Sale price cannot be negative.' });
    }

    if (low_stock_threshold !== undefined && (isNaN(parseInt(low_stock_threshold, 10)) || parseInt(low_stock_threshold, 10) < 0)) {
      return res.status(400).json({ error: 'Low stock threshold cannot be negative.' });
    }

    const item = await itemModel.getItemById(id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found.' });
    }

    const updatedItem = await itemModel.updateItem(id, { 
      name: name !== undefined ? name.trim() : undefined, 
      brand: brand !== undefined ? (brand ? brand.trim() : null) : undefined,
      sku: sku !== undefined ? (sku ? sku.trim() : null) : undefined, 
      quantity: quantity !== undefined ? parseInt(quantity, 10) : undefined, 
      category: category !== undefined ? (category ? category.trim() : null) : undefined, 
      cost_price: cost_price !== undefined ? parseFloat(cost_price) : undefined, 
      sale_price: sale_price !== undefined ? parseFloat(sale_price) : undefined, 
      photo_url, 
      low_stock_threshold: low_stock_threshold !== undefined ? parseInt(low_stock_threshold, 10) : undefined 
    });
    
    res.status(200).json(updatedItem);
  } catch (error) {
    console.error('Error updating item:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'An item with this SKU already exists.' });
    }
    res.status(500).json({ error: 'Internal server error while updating item.' });
  }
};

const deleteItem = async (req, res) => {
  try {
    // Only owner can delete (enforced by middleware ideally, but double check here if needed)
    if (req.user.role !== 'owner') {
      return res.status(403).json({ error: 'Staff members are not allowed to delete items' });
    }

    const item = await itemModel.deleteItem(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    res.status(200).json({ message: 'Item deleted successfully', item });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getItems,
  getItem,
  createItem,
  updateItem,
  deleteItem
};
