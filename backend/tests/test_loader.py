from app.tickets import load_tickets


tickets = load_tickets("../data/tickets.jsonl")

print("Number of tickets:", len(tickets))
print("First ticket ID:", tickets[0]["id"])
print("First ticket subject:", tickets[0]["subject"])