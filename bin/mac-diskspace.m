#import <Foundation/Foundation.h>
#import <stdio.h>

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        const char *path = argc > 1 ? argv[1] : "/";
        NSURL *url = [NSURL fileURLWithPath:[NSString stringWithUTF8String:path]];
        NSError *error = nil;
        NSDictionary *vals = [url resourceValuesForKeys:@[
            NSURLVolumeTotalCapacityKey,
            NSURLVolumeAvailableCapacityKey,
            NSURLVolumeAvailableCapacityForImportantUsageKey
        ] error:&error];
        
        long long total = [[vals objectForKey:NSURLVolumeTotalCapacityKey] longLongValue];
        long long free = [[vals objectForKey:NSURLVolumeAvailableCapacityKey] longLongValue];
        long long available = [[vals objectForKey:NSURLVolumeAvailableCapacityForImportantUsageKey] longLongValue];
        if (available <= 0) available = free;
        long long purgeable = available > free ? (available - free) : 0;
        
        printf("{\"total\":%lld,\"free\":%lld,\"available\":%lld,\"purgeable\":%lld}\n", total, free, available, purgeable);
    }
    return 0;
}

