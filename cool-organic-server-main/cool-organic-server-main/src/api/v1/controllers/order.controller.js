const Order = require('../models/order.model');
const Product = require('../models/product.model');
const Inventory = require('../models/inventory.model');
const orderService = require('../services/order.service');

const OrderController = {
  createOrder: async (req, res) => {
    let {
      email,
      fullName,
      phone,
      city,
      district,
      ward,
      comment,
      shippingMethod,
      shippingFee,
      paymentMethod,
      totalPrice,
      cart,
    } = req.body;
    if (
      !email ||
      !fullName ||
      !phone ||
      !city ||
      !district ||
      !ward ||
      !shippingMethod ||
      !shippingFee ||
      !paymentMethod ||
      !totalPrice ||
      !cart
    ) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập đầy đủ thông tin!',
      });
    }
    shippingMethod = orderService.handleShippingMethod(shippingMethod);
    paymentMethod = orderService.handlePaymentMethod(paymentMethod);

    try {
      const order = await Order.create({
        email,
        fullName,
        phone,
        city,
        district,
        ward,
        comment,
        shippingMethod,
        shippingFee,
        paymentMethod,
        totalPrice,
        cart,
        userId: req.userId,
      });
      if (!order) {
        return res.status(500).json({
          success: false,
          message: 'Đặt hàng thất bại, Vui lòng thử lại sau!',
        });
      }

      // Update inventory
      const handleUpdateInventory = async () => {
        for (const item of cart) {
          const productInventory = await Inventory.findOne({
            productId: item.product._id,
          }).populate('productId');
          if (!productInventory) {
            return res.status(500).json({
              success: false,
              message: 'Đặt hàng thất bại, Vui lòng thử lại sau!',
            });
          }
          productInventory.quantity -= item.quantity;
          if (productInventory.quantity < 0) {
            productInventory.quantity = 0;
            return res.status(500).json({
              success: false,
              message: `Sản phẩm ${productInventory.productId.name} đã hết hàng! Vui lòng thử lại sau!`,
            });
          }
          const product = await Product.findById(item.product._id);
          product.sold += item.quantity;
          await product.save();
          await productInventory.save();
        }
      };

      await handleUpdateInventory();

      return res.status(200).json({
        success: true,
        message: 'Đặt hàng thành công!',
        order,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Đặt hàng thất bại, Vui lòng thử lại sau!',
      });
    }
  },
  getAllOrders: async (req, res) => {
    let { page, limit } = req.query;

    try {
      if (page && limit) {
        page = Number(page);
        limit = Number(limit);
        const skip = (page - 1) * limit;
        const orders = await Order.find({})
          .sort({ createdAt: -1 })
          .limit(limit)
          .skip(skip);

        const totalOrders = await Order.countDocuments({});

        const totalPages = Math.ceil(totalOrders / limit);

        if (!orders) {
          return res.status(500).json({
            success: false,
            message: 'Có lỗi xảy ra, Vui lòng thử lại!',
          });
        }

        return res.status(200).json({
          success: true,
          orders,
          pagination: {
            currentPage: page,
            prePage: page > 1 ? page - 1 : null,
            nextPage: page < totalPages ? page + 1 : null,
            totalPages,
            total: totalOrders,
          },
        });
      } else {
        const orders = await Order.find({}).sort({ createdAt: -1 });
        return res.status(200).json({
          success: true,
          orders,
        });
      }
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Lấy đơn hàng thất bại, Vui lòng thử lại sau!',
      });
    }
  },
  getOrdersByUserId: async (req, res) => {
    const { id } = req.params;
    let { page, limit } = req.query;

    if (!page || !limit) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu dữ liệu truyền lên!',
      });
    }

    if (req.role === 'user' && req.userId !== id) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền truy cập!',
      });
    }

    try {
      page = Number(page);
      limit = Number(limit);
      const skip = (page - 1) * limit;
      const orders = await Order.find({
        userId: id,
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip);

      const totalOrders = await Order.countDocuments({
        userId: id,
      });

      const totalPages = Math.ceil(totalOrders / limit);

      if (!orders) {
        return res.status(500).json({
          success: false,
          message: 'Có lỗi xảy ra, Vui lòng thử lại!',
        });
      }

      return res.status(200).json({
        success: true,
        orders,
        pagination: {
          currentPage: page,
          prePage: page > 1 ? page - 1 : null,
          nextPage: page < totalPages ? page + 1 : null,
          totalPages,
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Lấy đơn hàng thất bại, Vui lòng thử lại sau!',
      });
    }
  },
  getOrderByOrderId: async (req, res) => {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu dữ liệu orderId!',
      });
    }

    try {
      const order = await Order.findOne({
        _id: orderId,
      });
      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy đơn hàng!',
        });
      }

      if (req.role === 'user' && req.userId !== order.userId) {
        return res.status(403).json({
          success: false,
          message: 'Bạn không có quyền truy cập!',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Lấy đơn hàng thành công!',
        order,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Lấy đơn hàng thất bại, Vui lòng thử lại sau!',
      });
    }
  },
  getTotalRevenue: async (req, res) => {
    try {
      const orders = await Order.find({
        shippingStatus: 'Giao hàng thành công',
        paymentStatus: 'Đã thanh toán',
      });
      let totalRevenue = 0;

      if (orders.length > 0) {
        totalRevenue = orders.reduce((acc, order) => {
          return acc + order.totalPrice;
        }, 0);
      }

      return res.status(200).json({
        success: true,
        totalRevenue,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Lấy doanh thu thất bại, Vui lòng thử lại sau!',
      });
    }
  },
  getCompareTwoMonthRevenue: async (req, res) => {
    try {
      const ordersCurrentMonth = await Order.find({
        shippingStatus: 'Giao hàng thành công',
        paymentStatus: 'Đã thanh toán',
        createdAt: {
          $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          $lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
        },
      });
      const ordersPreMonth = await Order.find({
        shippingStatus: 'Giao hàng thành công',
        paymentStatus: 'Đã thanh toán',
        createdAt: {
          $gte: new Date(
            new Date().getFullYear(),
            new Date().getMonth() - 1,
            1
          ),
          $lt: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      });

      let totalRevenueCurrentMonth = 0;
      let totalRevenuePreMonth = 0;

      if (ordersCurrentMonth.length > 0) {
        totalRevenueCurrentMonth = ordersCurrentMonth.reduce((acc, order) => {
          return acc + order.totalPrice;
        }, 0);
      }

      if (ordersPreMonth.length > 0) {
        totalRevenuePreMonth = ordersPreMonth.reduce((acc, order) => {
          return acc + order.totalPrice;
        }, 0);
      }

      return res.status(200).json({
        success: true,
        totalRevenueCurrentMonth,
        totalRevenuePreMonth,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Lấy doanh thu thất bại, Vui lòng thử lại sau!',
      });
    }
  },
  updateStatusOrder: async (req, res) => {
    const { shippingStatus, paymentStatus } = req.body;
    const { orderId } = req.params;

    if (!shippingStatus || !paymentStatus) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu dữ liệu truyền lên!',
      });
    }

    try {
      const order = await Order.findOneAndUpdate(
        {
          _id: orderId,
        },
        {
          shippingStatus,
          paymentStatus,
        },
        {
          new: true,
        }
      );

      return res.status(200).json({
        success: true,
        message: 'Cập nhật thông tin đơn hàng thành công!',
        order,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({
        success: false,
        message:
          'Cập nhật thông tin đơn hàng không thành công, Vui lòng thử lại sau!',
      });
    }
  },
  deleteOrder: async (req, res) => {
    const { orderId } = req.params;

    try {
      const order = await Order.findOneAndDelete({
        _id: orderId,
      });
      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy đơn hàng!',
        });
      }

      return res.status(200).json({
        success: true,
        order,
        message: 'Xóa đơn hàng thành công!',
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Xóa đơn hàng thất bại, Vui lòng thử lại sau!',
      });
    }
  },
};

module.exports = OrderController;
