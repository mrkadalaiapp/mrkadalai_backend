import prisma from "../../prisma/client.js";
//Ticket management
export const getTickets = async (req, res, next) => {
  const { outletId } = req.params;
  const intOutletId = parseInt(outletId);

  if (!intOutletId) {
    return res.status(400).json({ message: "Provide valid OutletId" });
  }

  try {
    const customers = await prisma.user.findMany({
      where: {
        role: "CUSTOMER",
        outletId: intOutletId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        customerInfo: {
          select: {
            id: true,
            tickets: {
              select: {
                id: true,
                description: true,
                priority: true,
                status: true,
                createdAt: true,
                resolutionNote: true,
                resolvedAt: true,
              },
            },
          },
        },
      },
    });

    const allTickets = customers.flatMap(user =>
      user.customerInfo?.tickets.map(ticket => ({
        ticketId: ticket.id,
        description: ticket.description,
        priority: ticket.priority,
        status: ticket.status,
        createdAt: ticket.createdAt,
        customerName: user.name,
        customerEmail: user.email,
        customerPhone: user.phone || 'N/A',
        resolutionNote: ticket.resolutionNote,
        resolvedAt: ticket.resolvedAt
      })) || []
    );

    res.status(200).json({ tickets: allTickets });

  } catch (err) {
    console.error("Error fetching tickets:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const ticketClose = async (req, res, next) => {
  const { ticketId, resolutionNote, resolvedAt } = req.body;
  const intTicketId = parseInt(ticketId);

  if (!ticketId || !resolutionNote || !resolvedAt) {
    return res.status(400).json({ message: "Provide ticketId, resolutionNote, and resolvedAt" });
  }

  try {
    const ticket = await prisma.ticket.update({
      where: { id: intTicketId },
      data: {
        status: "CLOSED",
        resolutionNote,
        resolvedAt: new Date(resolvedAt),
      },
    });

    res.status(200).json({
      message: "Ticket closed successfully",
      ticket,
    });
  } catch (err) {
    console.error("Error closing ticket:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};