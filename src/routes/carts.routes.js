import { Router } from 'express';
import productModel from '../dao/models/products.model.js';
import cartModel from '../dao/models/carts.model.js';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const cart = req.body;

    if (cart._id) {
      return res.status(400).json({ error: 'Cart already exists' });
    }

    if (!cart.products || cart.products.length === 0) {
      return res.status(400).json({ error: 'Cart must have at least one product' });
    }

    for (const product of cart.products) {
      const existingProduct = await productModel.findById(product.product);
      if (!existingProduct) {
        return res.status(400).json({ error: `Product ${product.product} does not exist` });
      }
    }

    const addCart = await cartModel.create(cart);
    res.status(201).json({ status: 'success', payload: addCart });
  } catch (err) {
    return res.status(500).json({ status: 'error', error: err.message });
  }
});

router.put('/:cid', async (req, res) => {
  try {
    const { cid } = req.params;
    const updatedCart = await cartModel.updateOne({ _id: cid }, { products: req.body });
    res.json({ status: 'success', payload: updatedCart });
  } catch (err) {
    return res.status(500).json({ status: 'error', error: err.message });
  }
});

router.put('/:cid/products/:pid/quantity', async (req, res) => {
  try {
    const { cid, pid } = req.params;
    const newQuantity = req.body.quantity;

    const cart = await cartModel.findById(cid);
    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    const productIndex = cart.products.findIndex(item => item.product.toString() === pid);

    if (productIndex !== -1) {
      cart.products[productIndex].quantity = newQuantity;
      await cart.save();

      // Notificar al usuario sobre el cambio
      const user = await userModel.findById(cart.userId);

      if (user) {
        const notification = {
          type: 'cart',
          message: `Product ${cart.products[productIndex].title} quantity updated to ${newQuantity}`,
        };
        await userModel.updateOne({ _id: user._id }, { notifications: [...user.notifications, notification] });
      }

      res.status(200).json({ message: 'Quantity updated successfully', payload: cart });
    } else {
      return res.status(404).json({ error: 'Product not found in the cart' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:cid', async (req, res) => {
  try {
    const cartId = req.params.cid;
    const cart = await cartModel.findById(cartId).populate('products.product');

    if (!cart) return res.status(404).json({ error: `The cart with id ${cartId} does not exist` });

    res.status(200).json({ status: 'success', payload: cart });
  } catch (err) {
    return res.status(500).json({ status: 'error', error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const limit = req.query.limit;
    const carts = await cartModel.find().lean().exec();

    if (limit) {
      const limitedCarts = carts.slice(0, limit);
      res.status(206).json(limitedCarts);
    } else {
      res.status(200).json({ carts: carts });
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ status: 'error', error: err.message });
  }
});

router.post('/:cid/product/:pid', async (req, res) => {
  try {
    const pid = req.params.pid;
    const product = await productModel.findById(pid);

    if (!product) {
      return res.status(404).json({ status: 'error', error: 'Invalid product' });
    }

    const cid = req.params.cid;
    const cart = await cartModel.findById(cid);

    if (!cart) {
      return res.status(404).json({ status: 'error', error: 'Invalid cart' });
    }

    const existingProductIndex = cart.products.findIndex(item => item.product.toString() === pid);

    if (existingProductIndex !== -1) {
      cart.products[existingProductIndex].quantity += 1;
    } else {
      const newProduct = {
        product: pid,
        quantity: 1,
      };
      cart.products.push(newProduct);
    }

    const result = await cart.save();
    res.status(200).json({ status: 'success', payload: result });
  } catch (err) {
    return res.status(500).json({ status: 'error', error: err.message });
  }
});

router.delete('/:cid/products/:pid', async (req, res) => {
  const { cid, pid } = req.params;

  try {
    const cart = await cartModel.findById(cid);
    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    cart.products.pull({ product: pid });
    await cart.save();

    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;