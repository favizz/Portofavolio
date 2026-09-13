import 'package:flutter/material.dart';

void main() => runApp(const WanderlistApp());

class WanderlistApp extends StatelessWidget {
  const WanderlistApp({super.key});

  @override
  Widget build(BuildContext context) {
    final scheme = ColorScheme.fromSeed(
      seedColor: const Color(0xFF14B8A6),
      brightness: Brightness.dark,
    );
    return MaterialApp(
      title: 'Wanderlist',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: scheme,
        scaffoldBackgroundColor: const Color(0xFF0A0A0C),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF0A0A0C),
          elevation: 0,
        ),
        cardTheme: CardThemeData(
          color: const Color(0xFF131317),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: const BorderSide(color: Color(0xFF26262E)),
          ),
        ),
      ),
      home: const TripListScreen(),
    );
  }
}

class Trip {
  Trip({required this.name, required this.destination, required this.days});
  final String name;
  final String destination;
  final List<ItineraryDay> days;
}

class ItineraryDay {
  ItineraryDay({required this.label, required this.items});
  final String label;
  final List<ItineraryItem> items;
}

class ItineraryItem {
  ItineraryItem({required this.title, this.done = false});
  final String title;
  bool done;
}

List<Trip> _seedTrips() => [
      Trip(
        name: 'Bandung Highlands',
        destination: 'Bandung, Indonesia',
        days: [
          ItineraryDay(label: 'Day 1', items: [
            ItineraryItem(title: 'Check in at Lembang guesthouse'),
            ItineraryItem(title: 'Dinner at Sundanese warung'),
          ]),
          ItineraryDay(label: 'Day 2', items: [
            ItineraryItem(title: 'Sunrise at Tangkuban Perahu'),
            ItineraryItem(title: 'Tea plantation walk'),
            ItineraryItem(title: 'Strawberry picking'),
          ]),
        ],
      ),
      Trip(
        name: 'Tokyo Long Weekend',
        destination: 'Tokyo, Japan',
        days: [
          ItineraryDay(label: 'Day 1', items: [
            ItineraryItem(title: 'Arrive Narita, train to Shinjuku'),
            ItineraryItem(title: 'Omoide Yokocho dinner'),
          ]),
        ],
      ),
    ];

class TripListScreen extends StatefulWidget {
  const TripListScreen({super.key});
  @override
  State<TripListScreen> createState() => _TripListScreenState();
}

class _TripListScreenState extends State<TripListScreen> {
  final List<Trip> _trips = _seedTrips();

  Future<void> _addTrip() async {
    final nameController = TextEditingController();
    final destController = TextEditingController();

    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF131317),
        title: const Text('New trip'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameController,
              decoration: const InputDecoration(labelText: 'Trip name'),
              autofocus: true,
            ),
            TextField(
              controller: destController,
              decoration: const InputDecoration(labelText: 'Destination'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Create'),
          ),
        ],
      ),
    );

    if (result == true && nameController.text.trim().isNotEmpty) {
      setState(() {
        _trips.add(Trip(
          name: nameController.text.trim(),
          destination: destController.text.trim().isEmpty
              ? 'Destination TBD'
              : destController.text.trim(),
          days: [ItineraryDay(label: 'Day 1', items: [])],
        ));
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Wanderlist')),
      body: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _trips.length,
        itemBuilder: (context, index) {
          final trip = _trips[index];
          final totalItems =
              trip.days.fold<int>(0, (sum, d) => sum + d.items.length);
          final doneItems = trip.days.fold<int>(
              0, (sum, d) => sum + d.items.where((i) => i.done).length);

          return Card(
            margin: const EdgeInsets.only(bottom: 12),
            child: ListTile(
              contentPadding: const EdgeInsets.all(16),
              title: Text(trip.name,
                  style: const TextStyle(fontWeight: FontWeight.w600)),
              subtitle: Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  '${trip.destination} · ${trip.days.length} day${trip.days.length == 1 ? '' : 's'}'
                  '${totalItems > 0 ? ' · $doneItems/$totalItems done' : ''}',
                ),
              ),
              trailing: const Icon(Icons.chevron_right),
              onTap: () async {
                await Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => TripDetailScreen(trip: trip),
                  ),
                );
                setState(() {}); // reflect any changes made on the detail screen
              },
            ),
          );
        },
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _addTrip,
        icon: const Icon(Icons.add),
        label: const Text('New trip'),
      ),
    );
  }
}

class TripDetailScreen extends StatefulWidget {
  const TripDetailScreen({super.key, required this.trip});
  final Trip trip;

  @override
  State<TripDetailScreen> createState() => _TripDetailScreenState();
}

class _TripDetailScreenState extends State<TripDetailScreen> {
  Future<void> _addItem(ItineraryDay day) async {
    final controller = TextEditingController();
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF131317),
        title: Text('Add to ${day.label}'),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(labelText: 'Activity'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Add'),
          ),
        ],
      ),
    );
    if (result == true && controller.text.trim().isNotEmpty) {
      setState(() => day.items.add(ItineraryItem(title: controller.text.trim())));
    }
  }

  void _addDay() {
    setState(() {
      widget.trip.days.add(
        ItineraryDay(label: 'Day ${widget.trip.days.length + 1}', items: []),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.trip.name)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(widget.trip.destination,
              style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 16),
          for (final day in widget.trip.days) ...[
            Text(day.label,
                style: const TextStyle(
                    fontWeight: FontWeight.w600, fontSize: 16)),
            const SizedBox(height: 8),
            Card(
              child: Column(
                children: [
                  for (final item in day.items)
                    CheckboxListTile(
                      value: item.done,
                      title: Text(
                        item.title,
                        style: TextStyle(
                          decoration:
                              item.done ? TextDecoration.lineThrough : null,
                          color: item.done ? Colors.grey : null,
                        ),
                      ),
                      onChanged: (v) =>
                          setState(() => item.done = v ?? false),
                    ),
                  ListTile(
                    leading: const Icon(Icons.add, size: 20),
                    title: const Text('Add activity'),
                    onTap: () => _addItem(day),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
          ],
          OutlinedButton.icon(
            onPressed: _addDay,
            icon: const Icon(Icons.add),
            label: const Text('Add another day'),
          ),
        ],
      ),
    );
  }
}
